import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const querySchema = z.object({
    period: z.enum(['week', 'month']).default('month'),
    anchorDate: z.coerce.date().optional(), // defaults to now
});

function startOfISOWeek(d) {
    const dt = new Date(d);
    const day = dt.getDay(); // 0..6 (Sun..Sat)
    const diff = (day === 0 ? -6 : 1 - day); // Monday start
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() + diff);
    return dt;
}
function endOfDay(d) {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    return dt;
}
function startOfMonth(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    dt.setDate(1);
    return dt;
}
function endOfMonth(d) {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    dt.setMonth(dt.getMonth() + 1, 0); // last day
    return dt;
}

// GET /api/reports/:slug/category-totals
router.get('/:slug/category-totals', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { period, anchorDate } = querySchema.parse(req.query);
        const today = anchorDate ?? new Date();

        // auth: must be a member of this budget
        const budget = await prisma.budget.findUnique({
            where: { slug },
            select: {
                id: true,
                members: { select: { userId: true } },
            },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const requesterId = req.user?.id;
        const memberIds = new Set(budget.members.map(m => m.userId));
        if (!requesterId || !memberIds.has(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // period window
        let from, to;
        if (period === 'week') {
            from = startOfISOWeek(today);
            to = endOfDay(new Date(from.getTime() + 6 * 24 * 3600 * 1000));
        } else {
            from = startOfMonth(today);
            to = endOfMonth(today);
        }

        // totals for categories that *have* purchases
        const grouped = await prisma.purchase.groupBy({
            by: ['categoryId'],
            where: {
                budgetId: budget.id,
                deletedAt: null,
                paidAt: { gte: from, lte: to },
            },
            _sum: { amount: true },
        });
        const totalsMap = new Map(grouped.map(g => [g.categoryId, Number(g._sum.amount || 0)]));

        // fetch *all* categories in this budget
        const categories = await prisma.category.findMany({
            where: { budgetId: budget.id },
            select: { id: true, name: true, slug: true, color: true, sortOrder: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });

        // merge totals (zero if none)
        const items = categories.map(c => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            color: c.color,
            total: totalsMap.get(c.id) ?? 0,
            sortOrder: c.sortOrder ?? 0,
        }));

        // sort: highest spend first, then by sortOrder/name for ties
        items.sort((a, b) => {
            const byTotal = b.total - a.total;
            if (byTotal !== 0) return byTotal;
            const byOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            if (byOrder !== 0) return byOrder;
            return a.name.localeCompare(b.name);
        });

        const grandTotal = items.reduce((s, x) => s + x.total, 0);

        res.json({
            period,
            range: { from, to },
            items: items.map(({ sortOrder, ...rest }) => rest), // hide sortOrder in payload
            grandTotal,
        });
    } catch (err) {
        next(err);
    }
});

export default router;