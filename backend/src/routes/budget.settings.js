import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { del } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

function shapeBudget(budget) {
    return {
        id: budget.id,
        name: budget.name,
        slug: budget.slug,
        bannerUrl: budget.bannerUrl,
        bannerStorageKey: budget.bannerStorageKey,
        bannerUpdatedAt: budget.bannerUpdatedAt,
        bannerColor: budget.bannerColor,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
    };
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

    return payload.sub;
}

async function getBudgetForMedia(slug) {
    return prisma.budget.findUnique({
        where: { slug },
        select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            bannerUrl: true,
            bannerStorageKey: true,
            bannerUpdatedAt: true,
            bannerColor: true,
            createdAt: true,
            updatedAt: true,
            members: {
                select: {
                    userId: true,
                    role: true,
                },
            },
        },
    });
}

function canManageBudgetAppearance(budget, userId) {
    if (budget.ownerId === userId) return true;
    const member = budget.members.find((m) => m.userId === userId);
    return member?.role === 'ADMIN';
}

const patchBannerSchema = z.object({
    bannerUrl: z.string().url(),
    bannerStorageKey: z.string().min(1),
    bannerColor: z.string().regex(/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/).nullable().optional(),
});

router.post('/:slug/banner', async (req, res, next) => {
    try {
        const jsonResponse = await handleUpload({
            body: req.body,
            request: req,
            onBeforeGenerateToken: async () => {
                const userId = await getUserFromCookie(req);
                const budget = await getBudgetForMedia(req.params.slug);

                if (!budget) {
                    const err = new Error('Budget not found');
                    err.status = 404;
                    throw err;
                }

                if (!canManageBudgetAppearance(budget, userId)) {
                    const err = new Error('Forbidden');
                    err.status = 403;
                    throw err;
                }

                return {
                    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    addRandomSuffix: true,
                    tokenPayload: JSON.stringify({
                        previousBannerStorageKey: budget.bannerStorageKey ?? null,
                    }),
                };
            },
        });

        return res.status(200).json(jsonResponse);
    } catch (err) {
        next(err);
    }
});

router.patch('/:slug/banner', verifyToken, async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const { slug } = req.params;

        const budget = await getBudgetForMedia(slug);
        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        if (!canManageBudgetAppearance(budget, userId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const rgbTripletSchema = z.string().regex(/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/);

        const bannerPaletteSchema = z.object({
            Vibrant: rgbTripletSchema.nullable().optional(),
            DarkVibrant: rgbTripletSchema.nullable().optional(),
            LightVibrant: rgbTripletSchema.nullable().optional(),
            Muted: rgbTripletSchema.nullable().optional(),
            DarkMuted: rgbTripletSchema.nullable().optional(),
            LightMuted: rgbTripletSchema.nullable().optional(),
        });

        const patchBannerSchema = z.object({
            bannerUrl: z.string().url(),
            bannerStorageKey: z.string().min(1),
            bannerColor: rgbTripletSchema.nullable().optional(),
            bannerPalette: bannerPaletteSchema.optional(),
        });

        const parsed = patchBannerSchema.parse(req.body);
        const oldStorageKey = budget.bannerStorageKey;

        const updatedBudget = await prisma.budget.update({
            where: { id: budget.id },
            data: {
                bannerUrl: parsed.bannerUrl,
                bannerStorageKey: parsed.bannerStorageKey,
                bannerColor: parsed.bannerColor ?? null,
                bannerColorVibrant: parsed.bannerPalette?.Vibrant ?? null,
                bannerColorDarkVibrant: parsed.bannerPalette?.DarkVibrant ?? null,
                bannerColorLightVibrant: parsed.bannerPalette?.LightVibrant ?? null,
                bannerColorMuted: parsed.bannerPalette?.Muted ?? null,
                bannerColorDarkMuted: parsed.bannerPalette?.DarkMuted ?? null,
                bannerColorLightMuted: parsed.bannerPalette?.LightMuted ?? null,
                bannerUpdatedAt: new Date(),
            },
            select: {
                id: true,
                name: true,
                slug: true,
                bannerUrl: true,
                bannerStorageKey: true,
                bannerUpdatedAt: true,
                bannerColor: true,
                bannerColorVibrant: true,
                bannerColorDarkVibrant: true,
                bannerColorLightVibrant: true,
                bannerColorMuted: true,
                bannerColorDarkMuted: true,
                bannerColorLightMuted: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (
            oldStorageKey &&
            oldStorageKey !== parsed.bannerStorageKey
        ) {
            try {
                await del(oldStorageKey);
            } catch (deleteErr) {
                console.error('Failed to delete previous budget banner blob:', deleteErr);
            }
        }

        res.json({
            budget: shapeBudget(updatedBudget),
        });
    } catch (err) {
        if (err?.name === 'ZodError') {
            return res.status(400).json({
                error: err.errors.map((e) => e.message).join(', '),
            });
        }
        next(err);
    }
});

router.delete('/:slug/banner', verifyToken, async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const { slug } = req.params;

        const budget = await getBudgetForMedia(slug);
        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        if (!canManageBudgetAppearance(budget, userId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const oldStorageKey = budget.bannerStorageKey;

        const updatedBudget = await prisma.budget.update({
            where: { id: budget.id },
            data: {
                bannerUrl: null,
                bannerStorageKey: null,
                bannerColor: null,
                bannerColorVibrant: null,
                bannerColorDarkVibrant: null,
                bannerColorLightVibrant: null,
                bannerColorMuted: null,
                bannerColorDarkMuted: null,
                bannerColorLightMuted: null,
                bannerUpdatedAt: new Date(),
            },
            select: {
                id: true,
                name: true,
                slug: true,
                bannerUrl: true,
                bannerStorageKey: true,
                bannerUpdatedAt: true,
                bannerColor: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (oldStorageKey) {
            try {
                await del(oldStorageKey);
            } catch (deleteErr) {
                console.error('Failed to delete budget banner blob:', deleteErr);
            }
        }

        res.json({
            budget: shapeBudget(updatedBudget),
        });
    } catch (err) {
        next(err);
    }
});

export default router;