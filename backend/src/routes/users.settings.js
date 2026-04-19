import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

const updateMeSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    displayName: z.union([
        z.string().trim().max(100),
        z.null(),
    ]).optional(),
});

function shapeUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        avatarStorageKey: user.avatarStorageKey,
        avatarUpdatedAt: user.avatarUpdatedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}

async function getCurrentUserOr404(userId) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            avatarStorageKey: true,
            avatarUpdatedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

router.get('/me', async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const user = await getCurrentUserOr404(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(shapeUser(user));
    } catch (err) {
        next(err);
    }
});

router.patch('/me', async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const parsed = updateMeSchema.parse(req.body);

        const currentUser = await getCurrentUserOr404(userId);

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const nextUsername = parsed.username.trim();
        const nextDisplayName =
            parsed.displayName === undefined
                ? currentUser.displayName
                : (parsed.displayName?.trim() ? parsed.displayName.trim() : null);

        if (nextUsername !== currentUser.username) {
            const existing = await prisma.user.findUnique({
                where: { username: nextUsername },
                select: { id: true },
            });

            if (existing && existing.id !== userId) {
                return res.status(409).json({ error: 'That username is already taken' });
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                username: nextUsername,
                displayName: nextDisplayName,
            },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                avatarUrl: true,
                avatarStorageKey: true,
                avatarUpdatedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.json(shapeUser(updatedUser));
    } catch (err) {
        if (err?.name === 'ZodError') {
            return res.status(400).json({
                error: err.errors.map((e) => e.message).join(', '),
            });
        }

        if (err?.code === 'P2002') {
            return res.status(409).json({ error: 'That username is already taken' });
        }

        next(err);
    }
});

export default router;