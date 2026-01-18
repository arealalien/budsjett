import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Resend } from 'resend';
import { prisma } from '../lib/prisma.js';
import { verifyEmailTemplate, resetPasswordTemplate } from '../lib/emails.js';
import { cacheGetOrSet, cacheSet, cacheDel } from '../lib/cache.js';

const router = Router();

// ---------- utils ----------
function setAuthCookie(res, token, maxAge) {
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge,
    });
}

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

function signSession(user, remember = false) {
    const expiresIn = remember ? '7d' : '1d';
    const payload = {
        sub: user.id,
        u: {
            username: user.username,
            displayName: user.displayName ?? null,
            email: user.email,
            verified: !!user.emailVerifiedAt,
        }
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
    const maxAge = remember ? 7*24*60*60*1000 : 24*60*60*1000;
    return { token, maxAge };
}

const MAIL_FROM = process.env.MAIL_FROM || 'Astrae <noreply@astrae.no>';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function extractFirstHref(html) {
    const m = html?.match?.(/href="([^"]+)"/i);
    return m ? m[1] : null;
}

async function sendEmail({ to, subject, html, text }) {
    if (!resend) {
        const url = extractFirstHref(html);
        console.log('--- DEV EMAIL (no RESEND_API_KEY) ---');
        console.log('To:', to);
        console.log('Subject:', subject);
        if (url) console.log('Link:', url);
        console.log('-------------------------------------');
        return { mode: 'dev', devLink: url };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: MAIL_FROM,
            to,
            subject,
            html,
            text,
            headers: {
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'List-Unsubscribe': `<mailto:noreply@astrae.no?subject=unsubscribe>`,
            },
        });

        if (error) {
            console.error('Resend send failed:', error);
            const url = extractFirstHref(html);
            return { mode: 'fallback', devLink: url, error: 'api-failed' };
        }

        console.log('Resend sent:', { id: data?.id });
        return { mode: 'api', messageId: data?.id || null };
    } catch (e) {
        console.error('Resend threw:', e?.message || e);
        const url = extractFirstHref(html);
        return { mode: 'fallback', devLink: url, error: 'api-throw' };
    }
}

function urlSafeToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function appUrl(path) {
    const base = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function readTokenFromReq(req) {
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

// Manual-invalidation cache (no TTL)
async function needsOnboardingCached(userId) {
    return cacheGetOrSet(`needsOnboarding:${userId}`, async () => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { onboardingSkippedAt: true },
        });
        if (!user) return true;
        if (user.onboardingSkippedAt) return false;
        const count = await prisma.budget.count({ where: { ownerId: userId } });
        return count === 0;
    });
}

// ---------- schemas ----------
const registerSchema = z.object({
    username: z.string()
        .min(3).max(50)
        .regex(/^[A-Za-z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: z.string().min(1).max(100).optional(),
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

router.get('/verify', async (req, res, next) => {
    try {
        const { token } = verifySchema.parse({ token: req.query.token });

        let verifiedUserId = null;

        await prisma.$transaction(async (tx) => {
            const record = await tx.authToken.findUnique({ where: { token } });
            if (!record || record.type !== 'EMAIL_VERIFY') throw Object.assign(new Error('Invalid token'), { status: 400 });
            if (record.consumedAt) throw Object.assign(new Error('Token already used'), { status: 400 });
            if (record.expiresAt < new Date()) throw Object.assign(new Error('Token expired'), { status: 400 });

            verifiedUserId = record.userId;

            await tx.user.update({
                where: { id: record.userId },
                data: { emailVerifiedAt: new Date() },
            });

            await tx.authToken.update({
                where: { token },
                data: { consumedAt: new Date() },
            });
        });

        // Invalidate cached “userVerified:<id>” so /me reflects verified status immediately
        if (verifiedUserId) cacheDel(`userVerified:${verifiedUserId}`);

        return res.json({ ok: true, message: 'Email verified. Please sign in to start onboarding.' });
    } catch (err) {
        if (err?.status === 400) return res.status(400).json({ error: err.message });
        if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        next(err);
    }
});

router.post('/verify/resend', async (req, res, next) => {
    try {
        const schema = z.object({ email: z.string().email() });
        const { email } = schema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.json({ ok: true });
        if (user.emailVerifiedAt) return res.json({ ok: true });

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

router.post('/login', async (req, res, next) => {
    try {
        const { usernameOrEmail, password, remember } = loginSchema.parse(req.body);

        const user = await prisma.user.findFirst({
            where: { OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                passwordHash: true,
                emailVerifiedAt: true,
            },
        });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (!user.emailVerifiedAt) {
            return res.status(403).json({ error: 'Email not verified. Check your email or request a new verification link.' });
        }

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');

        const { token, maxAge } = signSession(user, !!remember);
        setAuthCookie(res, token, maxAge);

        const onboarding = await needsOnboardingCached(user.id);

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

router.post('/password/forgot', async (req, res, next) => {
    try {
        const { email } = forgotSchema.parse(req.body);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.json({ ok: true });

        await prisma.authToken.deleteMany({
            where: { userId: user.id, type: 'PASSWORD_RESET' }
        });

        const token = urlSafeToken(32);
        const expiresAt = new Date(Date.now() + 60*60*1000);
        await prisma.authToken.create({
            data: { userId: user.id, token, type: 'PASSWORD_RESET', expiresAt }
        });

        const resetLink = appUrl(`/reset?token=${encodeURIComponent(token)}`);
        const tpl = resetPasswordTemplate({
            username: user.username,
            resetUrl: resetLink,
        });

        const emailResult = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
        });

        const body = { ok: true };
        if (emailResult?.devLink) body.devLink = emailResult.devLink;
        if (process.env.NODE_ENV !== 'production') body.devLink = body.devLink || resetLink;

        return res.json(body);
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

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
            out.username = !exists;
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

router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    res.status(204).end();
});

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
        color: z.string().min(3).max(20),
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
                select: { id: true, slug: true },
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

            const seen = new Set();
            rows.forEach(r => {
                let s = r.slug || 'cat';
                let k = s, n = 1;
                while (seen.has(k)) { k = `${s}-${++n}`; }
                r.slug = k.slice(0, 100);
                seen.add(k);
            });

            await tx.category.createMany({ data: rows });

            return created;
        });

        // Invalidate onboarding flag for this user
        cacheDel(`needsOnboarding:${userId}`);

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

        cacheDel(`needsOnboarding:${userId}`);

        return res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

router.get('/me', async (req, res) => {
    const token = readTokenFromReq(req);
    let payload;
    try { payload = token ? jwt.verify(token, process.env.JWT_SECRET) : null; }
    catch { return res.json(null); }
    if (!payload?.sub) return res.json(null);

    let base = {
        id: payload.sub,
        username: payload.u?.username ?? null,
        email: payload.u?.email ?? null,
        displayName: payload.u?.displayName ?? null,
        emailVerifiedAt: payload.u?.verified ? true : null,
    };

    // If the token says "unverified", check DB via cache (manual invalidation)
    if (!base.emailVerifiedAt) {
        const verified = await cacheGetOrSet(`userVerified:${payload.sub}`, async () => {
            const u = await prisma.user.findUnique({
                where: { id: payload.sub },
                select: { emailVerifiedAt: true, username: true, displayName: true, email: true },
            });
            return u || null; // it's okay if null; cache layer treats null as a miss later
        });
        if (verified) {
            base = {
                id: payload.sub,
                username: base.username ?? verified.username ?? null,
                email: base.email ?? verified.email ?? null,
                displayName: base.displayName ?? verified.displayName ?? null,
                emailVerifiedAt: verified.emailVerifiedAt ? true : null,
            };
        }
    }

    const needsOnboarding = await needsOnboardingCached(payload.sub);
    const body = { ...base, needsOnboarding };

    const etag = crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    res.set('Cache-Control', 'private, max-age=60');
    res.set('ETag', etag);
    return res.json(body);
});

export default router;
