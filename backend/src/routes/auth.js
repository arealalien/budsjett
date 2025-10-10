import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';

// If you already have verifyToken for protected endpoints, keep it; not needed here.
const router = Router();

// ---------- utils ----------
function zodMsg(err) {
    const issues = err?.issues || err?.errors || [];
    return Array.isArray(issues) && issues.length
        ? issues.map(i => i.message).join(', ')
        : (err?.message || 'Invalid input');
}

const usernameRegex = /^[A-Za-z0-9_]+$/;
const passwordSchema = z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[@$!%*?#&_]/, "Must contain a special character");

function signSession(userId, remember=false) {
    const expiresIn = remember ? '7d' : '1d';
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn });
    const maxAge = remember ? 7*24*60*60*1000 : 24*60*60*1000;
    return { token, maxAge };
}

function urlSafeToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url'); // ~43–86 chars; we store in VarChar(64)
}

const hasMailtrap = process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS;

const transport = hasMailtrap
    ? nodemailer.createTransport({
        host: 'sandbox.smtp.mailtrap.io',
        port: 2525,
        auth: { user: process.env.MAILTRAP_USER, pass: process.env.MAILTRAP_PASS },
    })
    : null;

async function sendEmail({ to, subject, html }) {
    if (!transport) {
        console.log('--- DEV EMAIL (no SMTP configured) ---');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log(html);
        console.log('--------------------------------------');
        return;
    }
    await transport.sendMail({ from: '"Budsjett" <no-reply@budsjett.local>', to, subject, html });
}

// For links in emails
function appUrl(path) {
    const base = process.env.APP_ORIGIN || 'http://localhost:3000';
    return `${base}${path}`;
}

// ---------- schemas ----------
const registerSchema = z.object({
    username: z.string()
        .min(3).max(50)
        .regex(usernameRegex, "Username can only contain letters, numbers, and underscores"),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

const loginSchema = z.object({
    usernameOrEmail: z.string().min(1),
    password: z.string(),
    remember: z.boolean().optional(),
});

const forgotSchema = z.object({
    email: z.string().email(),
});

const resetSchema = z.object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

const verifySchema = z.object({
    token: z.string().min(10),
});

// ---------- routes ----------

// POST /api/auth/register
// Creates user, stores verification token, emails link. DOES NOT log in.
router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password } = registerSchema.parse(req.body);

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const user = await prisma.user.create({
            data: { username, email, passwordHash },
            select: { id: true, username: true, email: true }
        });

        // create verify token (1 day)
        const token = urlSafeToken(32); // base64url ~43 chars
        const expiresAt = new Date(Date.now() + 24*60*60*1000);
        await prisma.authToken.create({
            data: {
                userId: user.id,
                token,
                type: 'EMAIL_VERIFY',
                expiresAt,
            }
        });

        const verifyLink = appUrl(`/verify?token=${encodeURIComponent(token)}`);
        await sendEmail({
            to: user.email,
            subject: 'Verify your account',
            html: `
        <p>Hi ${user.username},</p>
        <p>Thanks for signing up! Please verify your email by clicking the link below:</p>
        <p><a href="${verifyLink}">Verify my account</a></p>
        <p>This link expires in 24 hours.</p>
      `
        });

        res.status(201).json({ ok: true, message: 'Registered. Please check your email to verify your account.' });
    } catch (err) {
        if (err.code === 'P2002') {
            const field = err.meta?.target?.[0] || 'field';
            return res.status(409).json({ error: `${field} already taken` });
        }
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: zodMsg(err) });
        }
        next(err);
    }
});

// GET /api/auth/verify?token=...
// Verifies email; optionally seeds a default budget + categories after verification.
router.get('/verify', async (req, res, next) => {
    try {
        const { token } = verifySchema.parse({ token: req.query.token });

        const record = await prisma.authToken.findUnique({ where: { token } });
        if (!record || record.type !== 'EMAIL_VERIFY') {
            return res.status(400).json({ error: 'Invalid token' });
        }
        if (record.consumedAt) {
            return res.status(400).json({ error: 'Token already used' });
        }
        if (record.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Token expired' });
        }

        const user = await prisma.user.update({
            where: { id: record.userId },
            data: { emailVerifiedAt: new Date() },
            select: { id: true, username: true, emailVerifiedAt: true }
        });

        await prisma.authToken.update({
            where: { token },
            data: { consumedAt: new Date() }
        });

        // (Optional) Seed a starter budget + default categories if none exist yet
        const existing = await prisma.budget.findFirst({ where: { ownerId: user.id } });
        if (!existing) {
            const budget = await prisma.budget.create({
                data: {
                    ownerId: user.id,
                    name: 'My Budget',
                    members: { create: { userId: user.id, role: 'OWNER' } },
                }
            });

            const defaults = [
                { name: 'Furniture', slug: 'furniture', color: '#3b82f6', isSystem: true },
                { name: 'Groceries', slug: 'groceries', color: '#ef4444', isSystem: true },
                { name: 'Takeaway', slug: 'takeaway', color: '#f59e0b', isSystem: true },
                { name: 'Restaurant', slug: 'restaurant', color: '#10b981', isSystem: true },
                { name: 'Household', slug: 'household', color: '#06b6d4', isSystem: true },
                { name: 'Subscriptions', slug: 'subscriptions', color: '#a855f7', isSystem: true },
                { name: 'Other', slug: 'other', color: '#64748b', isSystem: true },
            ];
            await prisma.category.createMany({
                data: defaults.map((c, i) => ({ ...c, budgetId: budget.id, sortOrder: i }))
            });
        }

        return res.json({ ok: true, message: 'Email verified. You can sign in now.' });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

// POST /api/auth/verify/resend
router.post('/verify/resend', async (req, res, next) => {
    try {
        const schema = z.object({ email: z.string().email() });
        const { email } = schema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.json({ ok: true }); // do not leak
        if (user.emailVerifiedAt) return res.json({ ok: true });

        // invalidate old tokens of this type
        await prisma.authToken.deleteMany({
            where: { userId: user.id, type: 'EMAIL_VERIFY' }
        });

        const token = urlSafeToken(32);
        const expiresAt = new Date(Date.now() + 24*60*60*1000);

        await prisma.authToken.create({
            data: { userId: user.id, token, type: 'EMAIL_VERIFY', expiresAt }
        });

        const verifyLink = appUrl(`/verify?token=${encodeURIComponent(token)}`);
        await sendEmail({
            to: user.email,
            subject: 'Verify your account',
            html: `
        <p>Hi ${user.username},</p>
        <p>Click here to verify your account:</p>
        <p><a href="${verifyLink}">Verify my account</a></p>
      `
        });

        res.json({ ok: true });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { usernameOrEmail, password, remember } = loginSchema.parse(req.body);

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: usernameOrEmail },
                    { email: usernameOrEmail },
                ]
            }
        });
        // Generic error to avoid leaking which field failed
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        if (!user.emailVerifiedAt) {
            return res.status(403).json({ error: 'Email not verified. Check your email or request a new verification link.' });
        }

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
        const { token, maxAge } = signSession(user.id, !!remember);

        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge,
        });

        res.json({ id: user.id, username: user.username, email: user.email });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

// POST /api/auth/password/forgot
router.post('/password/forgot', async (req, res, next) => {
    try {
        const { email } = forgotSchema.parse(req.body);
        const user = await prisma.user.findUnique({ where: { email } });
        // Always return ok to avoid account enumeration
        if (!user) return res.json({ ok: true });

        // delete existing reset tokens
        await prisma.authToken.deleteMany({
            where: { userId: user.id, type: 'PASSWORD_RESET' }
        });

        const token = urlSafeToken(32);
        const expiresAt = new Date(Date.now() + 60*60*1000); // 1 hour
        await prisma.authToken.create({
            data: { userId: user.id, token, type: 'PASSWORD_RESET', expiresAt }
        });

        const resetLink = appUrl(`/reset?token=${encodeURIComponent(token)}`);
        await sendEmail({
            to: user.email,
            subject: 'Reset your password',
            html: `
        <p>Hi ${user.username},</p>
        <p>Click here to reset your password:</p>
        <p><a href="${resetLink}">Reset password</a></p>
        <p>This link expires in 1 hour.</p>
      `
        });

        res.json({ ok: true });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

// POST /api/auth/password/reset
router.post('/password/reset', async (req, res, next) => {
    try {
        const { token, password } = resetSchema.parse(req.body);
        const rec = await prisma.authToken.findUnique({ where: { token } });
        if (!rec || rec.type !== 'PASSWORD_RESET') {
            return res.status(400).json({ error: 'Invalid token' });
        }
        if (rec.consumedAt) return res.status(400).json({ error: 'Token already used' });
        if (rec.expiresAt < new Date()) return res.status(400).json({ error: 'Token expired' });

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
        await prisma.user.update({
            where: { id: rec.userId },
            data: { passwordHash }
        });

        await prisma.authToken.update({
            where: { token },
            data: { consumedAt: new Date() }
        });

        res.json({ ok: true, message: 'Password updated. You can sign in now.' });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    res.status(204).end();
});

// GET /api/auth/users (if you still need it)
router.get('/users', async (_req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, email: true }
        });
        res.json(users);
    } catch (err) { next(err); }
});

export default router;