import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const querySchema = z.object({
    period: z.enum(['week', 'month', 'year', 'all']).default('all'),
});

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

router.get('/:slug/reports/spending-trend', verifyToken, async (req, res) => {
    try {
        const { period } = querySchema.parse(req.query);
        const { slug } = req.params;

        const budget = await prisma.budget.findFirst({
            where: { slug },
            select: { id: true },
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        const range = await prisma.purchase.aggregate({
            where: {
                budgetId: budget.id,
                deletedAt: null,
            },
            _min: { paidAt: true },
            _max: { paidAt: true },
        });

        if (!range._min.paidAt || !range._max.paidAt) {
            return res.json({ points: [] });
        }

        let from = startOfDay(range._min.paidAt);
        let to = endOfDay(range._max.paidAt);

        const now = new Date();

        if (period === 'week') {
            from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
            to = endOfDay(now);
        }

        if (period === 'month') {
            from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
            to = endOfDay(now);
        }

        if (period === 'year') {
            from = startOfDay(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
            to = endOfDay(now);
        }

        const rows = await prisma.$queryRawUnsafe(
            `
                SELECT
                    series.day AS bucket,
                    COALESCE(SUM(p."amount"), 0)::numeric AS total
                FROM generate_series(
                             $1::date,
                             $2::date,
                             '1 day'::interval
                     ) AS series(day)
                         LEFT JOIN "Purchase" p
                                   ON p."paidAt"::date = series.day::date
                AND p."budgetId" = $3
                    AND p."deletedAt" IS NULL
                GROUP BY series.day
                ORDER BY series.day
            `,
            from,
            to,
            budget.id
        );

        const points = rows.map((r) => ({
            x: r.bucket,
            y: Number(r.total),
        }));

        const categoryTotals = await prisma.purchase.groupBy({
            by: ['categoryId'],
            where: {
                budgetId: budget.id,
                deletedAt: null,
                paidAt: {
                    gte: from,
                    lte: to,
                },
            },
            _sum: {
                amount: true,
            },
        });

        const categories = await prisma.category.findMany({
            where: { budgetId: budget.id },
            select: { id: true, name: true, color: true },
        });

        const categoryMap = new Map(categories.map((c) => [c.id, c]));

        const categoryData = categoryTotals
            .map((c) => {
                const cat = categoryMap.get(c.categoryId);

                return {
                    name: cat?.name || 'Unknown',
                    y: Number(c._sum.amount || 0),
                    color: cat?.color || '#888',
                };
            })
            .sort((a, b) => b.y - a.y);

        res.json({
            points,
            categories: categoryData,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;