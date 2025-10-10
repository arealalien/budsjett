import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const querySchema = z.object({
    period: z.enum(['week', 'month']).default('month'),
    anchorDate: z.coerce.date().optional(), // defaults to today
});

function startOfISOWeek(d) {
    const dt = new Date(d);
    const day = dt.getDay();      // 0..6 (Sun..Sat)
    const diff = (day === 0 ? -6 : 1 - day); // make Monday = day 1
    dt.setHours(0,0,0,0);
    dt.setDate(dt.getDate() + diff);
    return dt;
}
function endOfDay(d) {
    const dt = new Date(d);
    dt.setHours(23,59,59,999);
    return dt;
}
function startOfMonth(d) {
    const dt = new Date(d);
    dt.setHours(0,0,0,0);
    dt.setDate(1);
    return dt;
}
function endOfMonth(d) {
    const dt = new Date(d);
    dt.setHours(23,59,59,999);
    dt.setMonth(dt.getMonth()+1, 0); // last day of month
    return dt;
}

router.get('/category-totals', verifyToken, async (req, res, next) => {
    try {
        const { period, anchorDate } = querySchema.parse(req.query);
        const today = anchorDate ?? new Date();

        let from, to;
        if (period === 'week') {
            from = startOfISOWeek(today);
            to = endOfDay(new Date(from.getTime() + 6*24*3600*1000));
        } else {
            from = startOfMonth(today);
            to = endOfMonth(today);
        }

        // Group by category
        const grouped = await prisma.purchase.groupBy({
            by: ['category'],
            where: {
                deletedAt: null,
                paidAt: { gte: from, lte: to },
            },
            _sum: { amount: true },
        });

        // Shape response
        const items = grouped
            .map(g => ({
                category: g.category,
                total: Number(g._sum.amount || 0),
            }))
            .sort((a, b) => b.total - a.total);

        const grandTotal = items.reduce((s, x) => s + x.total, 0);

        res.json({
            period,
            range: { from, to },
            items,
            grandTotal,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
