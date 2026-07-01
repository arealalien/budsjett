import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { CACHE_TAGS, cacheGetOrSet, makeCacheKey } from '../lib/cache.js';

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

function categoryIdsForPurchase(purchase) {
    const ids = [...new Set(
        (purchase.categories || [])
            .map((entry) => entry.categoryId)
            .filter(Boolean)
    )];

    if (!ids.length && purchase.categoryId) {
        ids.push(purchase.categoryId);
    }

    return ids;
}

router.get('/:slug/reports/spending-trend', verifyToken, async (req, res) => {
    try {
        const { period } = querySchema.parse(req.query);
        const { slug } = req.params;
        const requesterId = req.userId || req.user?.id;

        const budgetInfo = await cacheGetOrSet('budget-info', {
            key: { slug, route: 'spending-trend' },
            ttl: 60_000,
            tags: [
                CACHE_TAGS.budgets,
                CACHE_TAGS.budgetSlug(slug),
            ],
            factory: async () => {
                const budget = await prisma.budget.findUnique({
                    where: { slug },
                    select: {
                        id: true,
                        ownerId: true,
                        members: { select: { userId: true } },
                    },
                });

                if (!budget) return null;

                return {
                    id: budget.id,
                    memberIds: [budget.ownerId, ...budget.members.map((m) => m.userId)],
                };
            },
        });

        if (!budgetInfo) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        if (!requesterId || !budgetInfo.memberIds.includes(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const payload = await cacheGetOrSet('reports:spending-trend', {
            key: { budgetId: budgetInfo.id, period },
            ttl: 60_000,
            tags: [
                CACHE_TAGS.reports,
                CACHE_TAGS.budget(budgetInfo.id),
                CACHE_TAGS.budgetReports(budgetInfo.id),
                CACHE_TAGS.budgetPurchases(budgetInfo.id),
                CACHE_TAGS.budgetCategories(budgetInfo.id),
            ],
            factory: async () => {
                const range = await prisma.purchase.aggregate({
                    where: {
                        budgetId: budgetInfo.id,
                        deletedAt: null,
                    },
                    _min: { paidAt: true },
                    _max: { paidAt: true },
                });

                if (!range._min.paidAt || !range._max.paidAt) {
                    return { points: [], categories: [] };
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
                    budgetInfo.id
                );

                const points = rows.map((r) => ({
                    x: r.bucket,
                    y: Number(r.total),
                }));

                const categoryPurchases = await prisma.purchase.findMany({
                    where: {
                        budgetId: budgetInfo.id,
                        deletedAt: null,
                        paidAt: {
                            gte: from,
                            lte: to,
                        },
                    },
                    select: {
                        amount: true,
                        categoryId: true,
                        categories: { select: { categoryId: true } },
                    },
                });

                const categories = await prisma.category.findMany({
                    where: { budgetId: budgetInfo.id },
                    select: { id: true, name: true, color: true },
                });

                const categoryMap = new Map(categories.map((c) => [c.id, c]));
                const totalsByCategory = {};

                for (const purchase of categoryPurchases) {
                    const categoryIds = categoryIdsForPurchase(purchase);
                    const share = Number(purchase.amount || 0) / Math.max(1, categoryIds.length);

                    for (const categoryId of categoryIds) {
                        totalsByCategory[categoryId] = (totalsByCategory[categoryId] || 0) + share;
                    }
                }

                const categoryData = Object.entries(totalsByCategory)
                    .map(([categoryId, total]) => {
                        const cat = categoryMap.get(categoryId);

                        return {
                            name: cat?.name || 'Unknown',
                            y: total,
                            color: cat?.color || '#888',
                        };
                    })
                    .sort((a, b) => b.y - a.y);

                return {
                    points,
                    categories: categoryData,
                };
            },
        });

        const etag = makeCacheKey(payload);
        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.set('Cache-Control', 'private, max-age=60');
        res.set('ETag', etag);
        res.json(payload);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
