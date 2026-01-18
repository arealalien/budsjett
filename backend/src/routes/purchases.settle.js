import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import { canAccessPurchase } from '../middleware/canAccessPurchase.js';
import { cacheDel } from '../lib/cache.js';

const router = Router();

const settleSchema = z.object({
    settled: z.boolean(),
});

/* -------- cache invalidation helpers (match other routes) -------- */
function sha1(obj) {
    return require('crypto').createHash('sha1')
        .update(typeof obj === 'string' ? obj : JSON.stringify(obj))
        .digest('hex');
}

// budget-scoped prefixes used elsewhere
const kBudgetAnyPrefix = (slug, budgetId) => [
    `budget:slug:${slug}`,
    `purchases:list:b:${budgetId}`,
    `budgets:list:u:`, // broad – evicts user lists (cheap & safe)
];
function invalidateBudgetCaches({ slug, budgetId }) {
    kBudgetAnyPrefix(slug, budgetId).forEach(p => cacheDel(p));
}

// user-scoped list caches from routes/purchases.js
function invalidatePurchasesListForUsers(userIds) {
    for (const id of new Set(userIds)) {
        cacheDel(`purchases:list:u:${id}:`);
    }
}

// PATCH /api/purchases/:id/settle
router.patch('/:id/settle', verifyToken, canAccessPurchase, async (req, res, next) => {
    try {
        const { settled } = settleSchema.parse(req.body);
        const id = req.params.id;

        // Pull enough to know who to invalidate (budget + members + payer)
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

        // Update all debtor shares (non-payer with >0%)
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

        // Updated purchase payload to return
        const updated = await prisma.purchase.findUnique({
            where: { id },
            include: {
                paidBy:   { select: { id: true, username: true, displayName: true } },
                shares:   { include: { user: { select: { id: true, username: true, displayName: true } } } },
                category: { select: { id: true, name: true } },
            },
        });

        invalidateBudgetCaches({ slug: purchaseMeta.budget.slug, budgetId: purchaseMeta.budget.id });

        const allMemberIds = [purchaseMeta.budget.ownerId, ...purchaseMeta.budget.members.map(m => m.userId)];
        invalidatePurchasesListForUsers(purchaseMeta.shared ? allMemberIds : [purchaseMeta.paidById]);

        res.json(updated);
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

export default router;