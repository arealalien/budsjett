import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

function shapeUser(u) {
    if (!u) return null;

    return {
        id: u.id,
        name: u.displayName ?? u.username ?? 'Unknown',
        username: u.username ?? null,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        avatarStorageKey: u.avatarStorageKey ?? null,
        avatarUpdatedAt: u.avatarUpdatedAt ?? null,
    };
}

router.get('/:slug/purchases/:purchaseId', verifyToken, async (req, res, next) => {
    try {
        const { slug, purchaseId } = req.params;
        const requesterId = req.user?.id || req.userId;

        const budget = await prisma.budget.findUnique({
            where: { slug },
            select: {
                id: true,
                ownerId: true,
                members: { select: { userId: true } },
            },
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        const isMember =
            requesterId === budget.ownerId ||
            budget.members.some((m) => m.userId === requesterId);

        if (!isMember) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const purchase = await prisma.purchase.findFirst({
            where: {
                id: purchaseId,
                budgetId: budget.id,
                deletedAt: null,
            },
            select: {
                id: true,
                itemName: true,
                amount: true,
                paidAt: true,
                shared: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    },
                },
                paidBy: {
                    select: {
                        id: true,
                        displayName: true,
                        username: true,
                        avatarUrl: true,
                        avatarStorageKey: true,
                        avatarUpdatedAt: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        displayName: true,
                        username: true,
                        avatarUrl: true,
                        avatarStorageKey: true,
                        avatarUpdatedAt: true,
                    },
                },
                shares: {
                    select: {
                        userId: true,
                        percent: true,
                        fixedAmount: true,
                        isSettled: true,
                        settledAt: true,
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                username: true,
                                avatarUrl: true,
                                avatarStorageKey: true,
                                avatarUpdatedAt: true,
                            },
                        },
                    },
                    orderBy: {
                        userId: 'asc',
                    },
                },
            },
        });

        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }

        res.json({
            id: purchase.id,
            itemName: purchase.itemName,
            amount: Number(purchase.amount),
            paidAt: purchase.paidAt,
            shared: purchase.shared,
            notes: purchase.notes,
            createdAt: purchase.createdAt,
            updatedAt: purchase.updatedAt,
            category: purchase.category
                ? {
                    id: purchase.category.id,
                    name: purchase.category.name,
                    color: purchase.category.color,
                }
                : null,
            paidBy: shapeUser(purchase.paidBy),
            createdBy: shapeUser(purchase.createdBy),
            shares: purchase.shares.map((s) => ({
                userId: s.userId,
                percent: s.percent,
                fixedAmount: s.fixedAmount != null ? Number(s.fixedAmount) : null,
                isSettled: s.isSettled,
                settledAt: s.settledAt,
                user: shapeUser(s.user),
            })),
        });
    } catch (err) {
        next(err);
    }
});

export default router;