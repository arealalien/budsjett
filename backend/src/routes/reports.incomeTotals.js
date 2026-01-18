import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { cacheGetOrSet, cacheDel } from '../lib/cache.js';

const router = Router();

const qSchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

const userName = (u) => u?.displayName ?? u?.username ?? 'Unknown';

// ---- cache keys ----
const keyBudgetInfo = (slug) => `budget:info:${slug}:withOwner`; // -> { id, ownerId, memberIds[] }
const keyMembers    = (budgetId) => `budget:${budgetId}:members:v1`; // -> [{id,displayName,username}]
const keyIncomeByUser = (budgetId, fromISO, toISO) =>
    `report:incomeTotals:byUser:${budgetId}:${fromISO || 'null'}:${toISO || 'null'}`;
const keyIncomeSum = (budgetId, fromISO, toISO) =>
    `report:incomeTotals:sum:${budgetId}:${fromISO || 'null'}:${toISO || 'null'}`;

function sha1(payload) {
    return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

router.get('/:slug/income-totals', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { dateFrom, dateTo } = qSchema.parse(req.query);
        const requesterId = req.userId; // set by verifyToken in your project

        const fromISO = dateFrom ? new Date(dateFrom).toISOString() : null;
        const toISO   = dateTo   ? new Date(dateTo).toISOString()   : null;

        // 1) Budget + memberIds + owner (cached)
        const budgetInfo = await cacheGetOrSet(keyBudgetInfo(slug), 60_000, async () => {
            const b = await prisma.budget.findUnique({
                where: { slug },
                select: {
                    id: true,
                    ownerId: true,
                    members: { select: { userId: true } },
                },
            });
            if (!b) return null;
            return { id: b.id, ownerId: b.ownerId, memberIds: [b.ownerId, ...b.members.map(m => m.userId)] };
        });
        if (!budgetInfo) return res.status(404).json({ error: 'Budget not found' });

        const memberSet = new Set(budgetInfo.memberIds);
        if (!requesterId || !memberSet.has(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // 2) Member display names (cached)
        const users = await cacheGetOrSet(keyMembers(budgetInfo.id), 5 * 60_000, async () => {
            const rows = await prisma.user.findMany({
                where: { id: { in: budgetInfo.memberIds } },
                select: { id: true, displayName: true, username: true },
            });
            return rows;
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

        // 4) Grouped income by receiver (cached per window)
        const grouped = await cacheGetOrSet(
            keyIncomeByUser(budgetInfo.id, fromISO, toISO),
            60_000,
            async () => {
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
            }
        );

        // 5) Aggregate grand total (cached per window)
        const totalIncome = await cacheGetOrSet(
            keyIncomeSum(budgetInfo.id, fromISO, toISO),
            60_000,
            async () => {
                const agg = await prisma.income.aggregate({
                    _sum: { amount: true },
                    where: {
                        budgetId: budgetInfo.id,
                        ...receivedAtFilter,
                    },
                });
                return Number(agg._sum.amount || 0);
            }
        );

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
        const etag = sha1(payload);
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