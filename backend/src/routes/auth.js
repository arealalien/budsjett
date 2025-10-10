import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

function zodMessages(err) {
    const issues = err?.issues || err?.errors || [];
    return Array.isArray(issues) && issues.length
        ? issues.map(i => i.message).join(', ')
        : (err?.message || 'Invalid input');
}

const passwordSchema = z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[@$!%*?#&_]/, "Must contain a special character");

const usernameRegex = /^[A-Za-z0-9_]+$/;

const registerSchema = z.object({
    password: passwordSchema,
    confirmPassword: z.string(),
    name: z.string()
        .min(3, "Username must be at least 3 characters")
        .max(50, "Username must be at most 50 characters")
        .regex(usernameRegex, "Username can only contain letters, numbers, and underscores"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
});

const loginSchema = z.object({
    name: z.string().min(3).max(50),
    password: z.string(),
    remember: z.boolean().optional()
});

router.post('/register', async (req, res, next) => {
    try {
        const { password, name } = registerSchema.parse({ ...req.body });
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');

        const normName = name.trim();

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const user = await prisma.user.create({
            data: { passwordHash: passwordHash, name: normName },
            select: { id: true, name: true }
        });

        const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json(user);
    } catch (err) {
        if (err.code === 'P2002') {
            const field = err.meta?.target?.join(', ') ?? 'field';
            return res.status(409).json({ error: `${field} already taken` });
        }
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

router.get('/users', async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true }
        });
        res.json(users);
    } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
    try {
        const { name, password, remember } = loginSchema.parse(req.body);
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');

        const normName = name.trim();

        const user = await prisma.user.findUnique({ where: { name: normName } });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const valid = await argon2.verify(user.passwordHash, password);
        if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

        const expiresIn = remember ? '7d' : '1d';
        const maxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn });

        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge
        });

        res.json({ id: user.id, name: user.name });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not signed in' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
                id: true,
                name: true,
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            ...user
        });
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

router.get('/user/:username', async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { name: req.params.username },
            select: {
                id: true,
                name: true,
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            ...user
        });
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

router.get('/account', verifyToken, async (req, res, next) => {
    try {
        const userId = req.user.id;

        const data = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
            }
        });

        res.json({
            ...data
        });
    } catch (err) {
        next(err);
    }
});

export default router;