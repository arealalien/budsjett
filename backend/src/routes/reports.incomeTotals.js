import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { CACHE_TAGS, cacheGetOrSet, makeCacheKey } from '../lib/cache.js';

const router = Router();

const qSchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

const userName = (u) => u?.displayName ?? u?.username ?? 'Unknown';

router.get('/:slug/income-totals', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { dateFrom, dateTo } = qSchema.parse(req.query);
        const requesterId = req.userId; // set by verifyToken in your project

        const fromISO = dateFrom ? new Date(dateFrom).toISOString() : null;
        const toISO   = dateTo   ? new Date(dateTo).toISOString()   : null;

        const budgetInfo = await cacheGetOrSet('budget-info', {
            key: { slug, route: 'income-totals' },
            ttl: 60_000,
            tags: [
                CACHE_TAGS.budgets,
                CACHE_TAGS.budgetSlug(slug),
            ],
            factory: async () => {
                const b = await prisma.budget.findUnique({
                    where: { slug },
                    select: {
                        id: true,
                        ownerId: true,
                        members: { select: { userId: true } },
                    },
                });
                if (!b) return null;
                return {
                    id: b.id,
                    ownerId: b.ownerId,
                    memberIds: [...new Set([b.ownerId, ...b.members.map((m) => m.userId)])],
                };
            },
        });
        if (!budgetInfo) return res.status(404).json({ error: 'Budget not found' });

        const memberSet = new Set(budgetInfo.memberIds);
        if (!requesterId || !memberSet.has(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const users = await cacheGetOrSet('budget-members', {
            key: { budgetId: budgetInfo.id, shape: 'income-totals-v1' },
            ttl: 5 * 60_000,
            tags: [
                CACHE_TAGS.budget(budgetInfo.id),
                CACHE_TAGS.budgetMembers(budgetInfo.id),
                ...budgetInfo.memberIds.map((userId) => CACHE_TAGS.user(userId)),
            ],
            factory: async () => {
                const rows = await prisma.user.findMany({
                    where: { id: { in: budgetInfo.memberIds } },
                    select: { id: true, displayName: true, username: true },
                });
                return rows;
            },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        // 3) Build date filter once (stable)
        const receivedAtFilter =
            dateFrom || dateTo
                ? {
                    receivedAt: {
                        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                        ...(dateTo ? { lte: new Date(dateTo) } : {}),
                    },
                }
                : {};

        const reportTags = [
            CACHE_TAGS.reports,
            CACHE_TAGS.budget(budgetInfo.id),
            CACHE_TAGS.budgetReports(budgetInfo.id),
        ];

        const grouped = await cacheGetOrSet('reports:income-totals:by-user', {
            key: { budgetId: budgetInfo.id, fromISO, toISO },
            ttl: 60_000,
            tags: reportTags,
            factory: async () => {
                const rows = await prisma.income.groupBy({
                    by: ['receivedById'],
                    _sum: { amount: true },
                    where: {
                        budgetId: budgetInfo.id,
                        ...receivedAtFilter,
                    },
                });
                // compact shape for stable ETag
                return rows.map((r) => ({
                    receivedById: r.receivedById,
                    total: Number(r._sum.amount || 0),
                }));
            },
        });

        const totalIncome = await cacheGetOrSet('reports:income-totals:sum', {
            key: { budgetId: budgetInfo.id, fromISO, toISO },
            ttl: 60_000,
            tags: reportTags,
            factory: async () => {
                const agg = await prisma.income.aggregate({
                    _sum: { amount: true },
                    where: {
                        budgetId: budgetInfo.id,
                        ...receivedAtFilter,
                    },
                });
                return Number(agg._sum.amount || 0);
            },
        });

        // 6) Shape response — include members with zero income too
        const byUser = new Map(grouped.map((g) => [g.receivedById, g.total]));
        const rows = budgetInfo.memberIds
            .map((id) => ({
                user: { id, name: userName(userMap.get(id)) },
                totalIncome: byUser.get(id) || 0,
            }))
            .sort((a, b) => b.totalIncome - a.totalIncome);

        const payload = {
            rows,
            totalIncome,
            dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
            dateTo: dateTo ? new Date(dateTo).toISOString() : null,
        };

        // 7) ETag / 304 + caching headers
        const etag = makeCacheKey(payload);
        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }
        res.set('Cache-Control', 'private, max-age=60');
        res.set('ETag', etag);
        res.json(payload);
    } catch (err) {
        next(err);
    }
});

export default router;
