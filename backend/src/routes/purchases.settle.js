import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import { canAccessPurchase } from '../middleware/canAccessPurchase.js';

const router = Router();

const settleSchema = z.object({
    settled: z.boolean(),
});

// PATCH /api/purchases/:id/settle
router.patch('/:id/settle', verifyToken, canAccessPurchase, async (req, res, next) => {
    try {
        const { settled } = settleSchema.parse(req.body);
        const id = req.params.id;

        // Find purchase to get paidById (we already know it exists from canAccessPurchase)
        const purchase = await prisma.purchase.findUnique({
            where: { id },
            select: { id: true, paidById: true },
        });
        if (!purchase) return res.status(404).json({ error: 'Not found' });

        // Update all *debtor* shares (the non-payer with percent > 0)
        await prisma.purchaseShare.updateMany({
            where: {
                purchaseId: id,
                userId: { not: purchase.paidById },
                percent: { gt: 0 },
            },
            data: {
                isSettled: settled,
                settledAt: settled ? new Date() : null,
            },
        });

        // Return the updated purchase
        const updated = await prisma.purchase.findUnique({
            where: { id },
            include: {
                paidBy: { select: { id: true, name: true } },
                shares: { include: { user: { select: { id: true, name: true } } } },
            },
        });

        res.json(updated);
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

export default router;
