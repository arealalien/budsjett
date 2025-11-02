import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { verifyEmailTemplate, resetPasswordTemplate } from '../lib/emails.js';

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


const MAIL_FROM = process.env.MAIL_FROM || 'Astrae <noreply@astrae.no>';

function makeTransport() {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure,
        requireTLS: !secure,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        tls: { servername: SMTP_HOST },
        family: 4,
        logger: true,
        debug: true,
    });
}

let transport = makeTransport();

async function verifyTransportOnce() {
    if (!transport) return { ok: false, reason: 'no-transport' };
    try {
        await transport.verify(); // checks TLS + auth
        return { ok: true };
    } catch (e) {
        console.error('SMTP verify failed:', e?.message || e);
        transport = null;
        return { ok: false, reason: e?.message || 'verify-failed' };
    }
}

let verifyPromise;

function ensureVerified() {
    if (!verifyPromise) verifyPromise = verifyTransportOnce();
    return verifyPromise;
}

function extractFirstHref(html) {
    const m = html?.match?.(/href="([^"]+)"/i);
    return m ? m[1] : null;
}

async function sendEmail({ to, subject, html, text }) {
    await ensureVerified();

    if (!transport) {
        const url = extractFirstHref(html);
        console.log('--- DEV EMAIL (no SMTP) ---');
        console.log('To:', to);
        console.log('Subject:', subject);
        if (url) console.log('Link:', url);
        console.log('---------------------------');
        return { devLink: url };
    }

    try {
        await transport.sendMail({ from: MAIL_FROM, to, subject, html, text });
        return {};
    } catch (e) {
        console.error('sendMail failed:', e?.message || e);
        const url = extractFirstHref(html);
        transport = null;
        return { devLink: url, error: 'smtp-failed' };
    }
}


function urlSafeToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

// For links in emails
function appUrl(path) {
    const base = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function readTokenFromReq(req) {
    // Prefer cookie; fall back to "Authorization: Bearer <token>"
    const bearer = req.get('authorization');
    const headerToken = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null;
    return req.cookies?.token || headerToken || null;
}

function verifyJwtOrNull(token) {
    try {
        if (!token) return null;
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

async function needsOnboarding(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingSkippedAt: true },
    });
    if (!user) return true;
    if (user.onboardingSkippedAt) return false;

    const count = await prisma.budget.count({ where: { ownerId: userId } });
    return count === 0;
}

// ---------- schemas ----------
const registerSchema = z.object({
    username: z.string()
        .min(3).max(50)
        .regex(/^[A-Za-z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: z.string().min(1).max(100).optional(), // <-- add this
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
        const { username, email, password, displayName } = registerSchema.parse(req.body);
        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const user = await prisma.user.create({
            data: { username, email, passwordHash, displayName },
            select: { id: true, username: true, email: true }
        });

        const token = urlSafeToken(32);
        const expiresAt = new Date(Date.now() + 24*60*60*1000);

        await prisma.authToken.create({
            data: { userId: user.id, token, type: 'EMAIL_VERIFY', expiresAt }
        });

        const verifyLink = appUrl(`/verify?token=${encodeURIComponent(token)}`);
        const tpl = verifyEmailTemplate({ username: user.username, verifyUrl: verifyLink });

        const emailResult = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
        });

        // Return dev link only when we didn't actually send an email
        const body = { ok: true, message: 'Registered. Please check your email to verify your account.' };
        if (emailResult?.devLink) body.devLink = emailResult.devLink;
        if (process.env.NODE_ENV !== 'production') body.devLink = body.devLink || verifyLink;

        res.status(201).json(body);
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

        await prisma.$transaction(async (tx) => {
            const record = await tx.authToken.findUnique({ where: { token } });
            if (!record || record.type !== 'EMAIL_VERIFY') throw Object.assign(new Error('Invalid token'), { status: 400 });
            if (record.consumedAt) throw Object.assign(new Error('Token already used'), { status: 400 });
            if (record.expiresAt < new Date()) throw Object.assign(new Error('Token expired'), { status: 400 });

            await tx.user.update({
                where: { id: record.userId },
                data: { emailVerifiedAt: new Date() },
            });

            await tx.authToken.update({
                where: { token },
                data: { consumedAt: new Date() },
            });
        });

        return res.json({ ok: true, message: 'Email verified. Please sign in to start onboarding.' });
    } catch (err) {
        if (err?.status === 400) return res.status(400).json({ error: err.message });
        if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
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

        const onboarding = await needsOnboarding(user.id);

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName ?? null,
            needsOnboarding: onboarding,
        });
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

router.get('/availability', async (req, res, next) => {
    try {
        const { username, email, displayName } = req.query;
        const out = {};

        if (typeof username === 'string' && username.trim() !== '') {
            const exists = await prisma.user.findFirst({
                where: { username: { equals: username.trim(), mode: 'insensitive' } },
                select: { id: true },
            });
            out.username = !exists; // true means FREE
        }

        if (typeof email === 'string' && email.trim() !== '') {
            const exists = await prisma.user.findFirst({
                where: { email: { equals: email.trim(), mode: 'insensitive' } },
                select: { id: true },
            });
            out.email = !exists;
        }

        if (typeof displayName === 'string' && displayName.trim() !== '') {
            const exists = await prisma.user.findFirst({
                where: { displayName: { equals: displayName.trim(), mode: 'insensitive' } },
                select: { id: true },
            });
            out.displayName = !exists;
        }

        res.json({ ok: true, ...out });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    const token = readTokenFromReq(req);
    const payload = verifyJwtOrNull(token);

    if (!payload?.sub) {
        return res.json(null);
    }

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            emailVerifiedAt: true,
            createdAt: true,
        },
    });

    if (!user) return res.json(null);

    const onboarding = await needsOnboarding(user.id);

    return res.json({
        ...user,
        needsOnboarding: onboarding,
    });
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

const onboardingSchema = z.object({
    budgetName: z.string().min(1).max(191),
    categories: z.array(z.object({
        name: z.string().min(1).max(80),
        color: z.string().min(3).max(20), // "R, G, B"
        planMonthly: z.number().min(0).max(99999999.99).default(0),
    })).min(1).max(100)
});

function requireAuth(req) {
    const payload = verifyJwtOrNull(readTokenFromReq(req));
    if (!payload?.sub) {
        const e = new Error('Not authenticated');
        e.status = 401;
        throw e;
    }
    return payload.sub;
}

function slugify(s) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 100);
}

function randomSlugSegment(length = 8) {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

async function uniqueBudgetSlug(tx) {
    let slug;
    while (true) {
        slug = randomSlugSegment(10);
        const exists = await tx.budget.findUnique({ where: { slug } });
        if (!exists) break;
    }
    return slug;
}

// POST /api/onboarding
router.post('/onboarding', async (req, res, next) => {
    try {
        const userId = requireAuth(req);
        const { budgetName, categories } = onboardingSchema.parse(req.body);

        const already = await prisma.budget.count({ where: { ownerId: userId } });
        if (already > 0) {
            return res.status(409).json({ error: 'Onboarding already completed.' });
        }

        const budget = await prisma.$transaction(async (tx) => {
            const slug = await uniqueBudgetSlug(tx);

            const created = await tx.budget.create({
                data: {
                    ownerId: userId,
                    name: budgetName,
                    slug,
                    members: { create: { userId, role: 'OWNER' } },
                },
                select: { id: true, slug: true }, // only what we need
            });

            const rows = categories.map((c, i) => ({
                budgetId: created.id,
                name: c.name.trim(),
                slug: slugify(c.name),
                color: c.color.trim(),
                planMonthly: (c.planMonthly ?? 0).toFixed(2),
                sortOrder: i,
                isSystem: false,
            }));

            // ensure unique slugs within this budget’s categories
            const seen = new Set();
            rows.forEach(r => {
                let s = r.slug || 'cat';
                let k = s, n = 1;
                while (seen.has(k)) { k = `${s}-${++n}`; }
                r.slug = k.slice(0, 100);
                seen.add(k);
            });

            await tx.category.createMany({ data: rows });

            return created; // <-- return something!
        });

        res.json({ ok: true, slug: budget.slug, budgetId: budget.id });
    } catch (err) {
        if (err?.status === 401) return res.status(401).json({ error: err.message });
        if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        next(err);
    }
});

router.post('/onboarding/skip', async (req, res, next) => {
    try {
        const userId = requireAuth(req);
        await prisma.user.update({
            where: { id: userId },
            data: { onboardingSkippedAt: new Date() },
        });
        return res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;