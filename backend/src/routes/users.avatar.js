import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { del } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

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

async function getUserFromCookie(req) {
    const token = req.cookies?.token;
    if (!token) {
        const err = new Error('Not authenticated');
        err.status = 401;
        throw err;
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        const err = new Error('Invalid token');
        err.status = 401;
        throw err;
    }

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
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

    if (!user) {
        const err = new Error('Invalid token user');
        err.status = 401;
        throw err;
    }

    return user;
}

// POST /api/users/me/avatar
// This is NOT a multipart route.
// It is the handleUpload token + completion route.
router.post('/me/avatar', async (req, res, next) => {
    try {
        const jsonResponse = await handleUpload({
            body: req.body,
            request: req,

            onBeforeGenerateToken: async () => {
                const user = await getUserFromCookie(req);

                return {
                    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    addRandomSuffix: true,
                    tokenPayload: JSON.stringify({
                        userId: user.id,
                        previousAvatarStorageKey: user.avatarStorageKey ?? null,
                    }),
                };
            },

            onUploadCompleted: async ({ blob, tokenPayload }) => {
                const parsed = JSON.parse(tokenPayload || '{}');
                const previousAvatarStorageKey = parsed.previousAvatarStorageKey;

                if (
                    previousAvatarStorageKey &&
                    previousAvatarStorageKey !== blob.pathname
                ) {
                    try {
                        await del(previousAvatarStorageKey);
                    } catch (deleteErr) {
                        console.error('Failed to delete previous avatar blob:', deleteErr);
                    }
                }
            },
        });

        return res.status(200).json(jsonResponse);
    } catch (err) {
        return next(err);
    }
});

router.patch('/me/avatar', verifyToken, async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const { avatarUrl, avatarStorageKey } = req.body || {};

        if (!avatarUrl || !avatarStorageKey) {
            return res.status(400).json({ error: 'Missing avatarUrl or avatarStorageKey' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarUrl,
                avatarStorageKey,
                avatarUpdatedAt: new Date(),
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

        res.json({
            user: shapeUser(updatedUser),
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/users/me/avatar
router.delete('/me/avatar', verifyToken, async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const currentUser = await getCurrentUserOr404(userId);

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const oldStorageKey = currentUser.avatarStorageKey;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarUrl: null,
                avatarStorageKey: null,
                avatarUpdatedAt: new Date(),
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

        if (oldStorageKey) {
            try {
                await del(oldStorageKey);
            } catch (deleteErr) {
                console.error('Failed to delete avatar blob:', deleteErr);
            }
        }

        res.json({
            user: shapeUser(updatedUser),
        });
    } catch (err) {
        next(err);
    }
});

export default router;