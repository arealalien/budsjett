import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import { canAccessPurchase } from '../middleware/canAccessPurchase.js';
import { invalidateBudgetCaches } from '../lib/cacheInvalidation.js';

const router = Router();

const settleSchema = z.object({
    settled: z.boolean(),
});

// PATCH /api/purchases/:id/settle
router.patch('/:id/settle', verifyToken, canAccessPurchase, async (req, res, next) => {
    try {
        const { settled } = settleSchema.parse(req.body);
        const id = req.params.id;

        const purchaseMeta = await prisma.purchase.findUnique({
            where: { id },
            select: {
                id: true,
                paidById: true,
                shared: true,
                budget: {
                    select: {
                        id: true,
                        slug: true,
                        ownerId: true,
                        members: { select: { userId: true } },
                    },
                },
            },
        });
        if (!purchaseMeta) return res.status(404).json({ error: 'Not found' });

        await prisma.purchaseShare.updateMany({
            where: {
                purchaseId: id,
                userId: { not: purchaseMeta.paidById },
                percent: { gt: 0 },
            },
            data: {
                isSettled: settled,
                settledAt: settled ? new Date() : null,
            },
        });

        const updated = await prisma.purchase.findUnique({
            where: { id },
            include: {
                paidBy: { select: { id: true, username: true, displayName: true } },
                shares: { include: { user: { select: { id: true, username: true, displayName: true } } } },
                category: { select: { id: true, name: true } },
            },
        });

        const allMemberIds = [purchaseMeta.budget.ownerId, ...purchaseMeta.budget.members.map((m) => m.userId)];
        invalidateBudgetCaches({
            slug: purchaseMeta.budget.slug,
            budgetId: purchaseMeta.budget.id,
            userIds: purchaseMeta.shared ? allMemberIds : [purchaseMeta.paidById],
        });

        res.json(updated);
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
        }
        next(err);
    }
});

export default router;
