import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const querySchema = z.object({
    period: z.enum(['week','month','year','all']).default('all'),
});

router.get('/:slug/reports/spending-trend', verifyToken, async (req, res) => {
    try {
        const { period } = querySchema.parse(req.query);
        const { slug } = req.params;

        // ---- get budget ----
        const budget = await prisma.budget.findFirst({
            where: { slug },
            select: { id: true }
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        // ---- get real data range (THIS FIXES 1970) ----
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

        let from = range._min.paidAt;
        let to = range._max.paidAt;

        // ---- optional period filters ----
        const now = new Date();

        if (period === 'week') {
            from = new Date(now);
            from.setDate(now.getDate() - 7);
            to = now;
        }

        if (period === 'month') {
            from = new Date(now);
            from.setMonth(now.getMonth() - 1);
            to = now;
        }

        if (period === 'year') {
            from = new Date(now);
            from.setFullYear(now.getFullYear() - 1);
            to = now;
        }

        // ---- generate continuous daily series ----
        const rows = await prisma.$queryRawUnsafe(`
                    SELECT
                        series.date AS bucket,
                        COALESCE(SUM(p."amount"), 0)::numeric AS total
                    FROM generate_series(
                                 $1::timestamp,
                                 $2::timestamp,
                                 '1 day'::interval
                         ) AS series(date)
                             LEFT JOIN "Purchase" p
                                       ON date_trunc('day', p."paidAt") = series.date
                                           AND p."budgetId" = $3
                                           AND p."deletedAt" IS NULL
                    GROUP BY series.date
                    ORDER BY series.date
            `,
            from,
            to,
            budget.id
        );

        const points = rows.map(r => ({
            x: r.bucket,
            y: Number(r.total)
        }));

        const categoryTotals = await prisma.purchase.groupBy({
            by: ['categoryId'],
            where: {
                budgetId: budget.id,
                deletedAt: null,
                paidAt: {
                    gte: from,
                    lte: to
                }
            },
            _sum: {
                amount: true
            }
        });


        const categories = await prisma.category.findMany({
            where: { budgetId: budget.id },
            select: { id: true, name: true, color: true }
        });

        const categoryMap = new Map(categories.map(c => [c.id, c]));

        const categoryData = categoryTotals
            .map(c => {
                const cat = categoryMap.get(c.categoryId);

                return {
                    name: cat?.name || 'Unknown',
                    y: Number(c._sum.amount || 0),
                    color: cat?.color || '#888' // ✅ color added
                };
            })
            .sort((a, b) => b.y - a.y);

        res.json({
            points,
            categories: categoryData
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;