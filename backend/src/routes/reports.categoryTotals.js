import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { cacheGetOrSet } from '../lib/cache.js';

const router = Router();

const TTL_BUDGET_INFO = 60_000;     // who can see + id
const TTL_CATEGORIES  = 5 * 60_000; // categories change rarely
const TTL_TOTALS = null;     // range totals (refresh on new purchases via invalidation elsewhere)

const querySchema = z.object({
    period: z.enum(['week', 'month']).default('month'),
    anchorDate: z.coerce.date().optional(),
});

// ---------- date utils ----------
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
    dt.setMonth(dt.getMonth() + 1, 0);
    return dt;
}
function computeRange(period, anchor) {
    if (period === 'week') {
        const from = startOfISOWeek(anchor);
        const to = endOfDay(new Date(from.getTime() + 6 * 24 * 3600 * 1000));
        return { from, to };
    }
    const from = startOfMonth(anchor);
    const to = endOfMonth(anchor);
    return { from, to };
}

// ---------- cache keys ----------
const keyBudgetInfo = (slug) => `budget:info:${slug}:v1`;           // -> { id, memberIds[] }
const keyBudgetCats = (budgetId) => `budget:${budgetId}:cats:v1`;   // -> categories[]
const keyTotals = (budgetId, fromISO, toISO) =>
    `report:catTotals:${budgetId}:${fromISO}:${toISO}:v1`;

// ---------- helpers ----------
function sha(payload) {
    return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

// GET /api/reports/:slug/category-totals
router.get('/:slug/category-totals', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { period, anchorDate } = querySchema.parse(req.query);
        const today = anchorDate ?? new Date();
        const requesterId = req.userId || req.user?.id;

        // 1) membership + budgetId (cached)
        const budgetInfo = await cacheGetOrSet(
            keyBudgetInfo(slug),
            TTL_BUDGET_INFO,
            async () => {
                const b = await prisma.budget.findUnique({
                    where: { slug },
                    select: { id: true, members: { select: { userId: true } } },
                });
                if (!b) return undefined; // don't cache hard "not found"
                return { id: b.id, memberIds: b.members.map((m) => m.userId) };
            }
        );

        if (!budgetInfo?.id) return res.status(404).json({ error: 'Budget not found' });
        if (!requesterId || !budgetInfo.memberIds.includes(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // 2) time window
        const { from, to } = computeRange(period, today);
        const fromISO = from.toISOString();
        const toISO = to.toISOString();

        // 3) categories (cached)
        const categories = await cacheGetOrSet(
            keyBudgetCats(budgetInfo.id),
            TTL_CATEGORIES,
            async () => {
                return prisma.category.findMany({
                    where: { budgetId: budgetInfo.id },
                    select: { id: true, name: true, slug: true, color: true, sortOrder: true },
                    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                });
            }
        );

        // 4) totals grouped by category (cached per range)
        const groupedMap = await cacheGetOrSet(
            keyTotals(budgetInfo.id, fromISO, toISO),
            TTL_TOTALS,
            async () => {
                const rows = await prisma.purchase.groupBy({
                    by: ['categoryId'],
                    where: {
                        budgetId: budgetInfo.id,
                        deletedAt: null,
                        paidAt: { gte: from, lte: to },
                    },
                    _sum: { amount: true },
                });
                const out = {};
                for (const r of rows) out[r.categoryId] = Number(r._sum.amount || 0);
                return out;
            }
        );

        // 5) merge + sort (always include zero totals)
        const items = categories.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            color: c.color,
            total: groupedMap[c.id] ?? 0,
            sortOrder: c.sortOrder ?? 0,
        }));

        items.sort((a, b) => {
            const byTotal = b.total - a.total;
            if (byTotal !== 0) return byTotal;
            const byOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            if (byOrder !== 0) return byOrder;
            return a.name.localeCompare(b.name);
        });

        const grandTotal = items.reduce((s, x) => s + x.total, 0);

        const payload = {
            period,
            range: { from, to },
            items: items.map(({ sortOrder, ...rest }) => rest),
            grandTotal,
        };

        // 6) ETag / 304
        const etag = sha(payload);
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