import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { cacheGetOrSet } from '../lib/cache.js';

const router = Router();

const TTL = 60_000;

const querySchema = z.object({
    period: z.enum(['week', 'month', 'lastMonth', 'all']).default('month'),
});

// ---------- date utils ----------
function startOfISOWeek(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() + diff);
    return dt;
}
function startOfMonth(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    dt.setDate(1);
    return dt;
}

function computeRange(period, anchor) {
    if (period === 'week') {
        const from = startOfISOWeek(anchor);
        const to = new Date(from);
        to.setDate(to.getDate() + 6);
        return { from, to };
    }

    if (period === 'lastMonth') {
        const d = new Date(anchor);
        d.setMonth(d.getMonth() - 1);
        return {
            from: startOfMonth(d),
            to: new Date(d.getFullYear(), d.getMonth() + 1, 0),
        };
    }

    if (period === 'all') return null;

    return {
        from: startOfMonth(anchor),
        to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
    };
}

// ---------- helpers ----------
function sha(payload) {
    return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

// ---------- route ----------
router.get('/:slug/category-trend', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { period } = querySchema.parse(req.query);
        const today = new Date();
        const requesterId = req.userId || req.user?.id;

        // 1) budget + membership
        const budget = await prisma.budget.findUnique({
            where: { slug },
            select: { id: true, members: { select: { userId: true } } },
        });

        if (!budget) return res.status(404).json({ error: 'Budget not found' });
        if (!budget.members.some(m => m.userId === requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // 2) range
        const range = computeRange(period, today);

        const where = {
            budgetId: budget.id,
            deletedAt: null,
            ...(range && {
                paidAt: {
                    gte: range.from,
                    lte: range.to,
                }
            })
        };

        // 3) categories
        const categories = await prisma.category.findMany({
            where: { budgetId: budget.id },
            select: { id: true, name: true, color: true },
        });

        // 4) purchases
        const purchases = await prisma.purchase.findMany({
            where,
            select: {
                amount: true,
                categoryId: true,
                paidAt: true,
            },
            orderBy: { paidAt: 'asc' }
        });

        const start = range?.from || purchases[0]?.paidAt;
        const end = range?.to || purchases[purchases.length - 1]?.paidAt;

        if (!start || !end) {
            return res.json({ series: [] });
        }

        const dates = [];
        let d = new Date(start);

        while (d <= end) {
            dates.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }

        const map = {};

        for (const p of purchases) {
            const key = new Date(p.paidAt).toISOString().split("T")[0];

            if (!map[p.categoryId]) map[p.categoryId] = {};
            map[p.categoryId][key] = (map[p.categoryId][key] || 0) + Number(p.amount);
        }

        const series = categories.map(cat => {
            const pointsMap = map[cat.id] || {};

            const points = dates.map(date => {
                const key = date.toISOString().split("T")[0];

                return {
                    x: date,
                    y: pointsMap[key] || 0
                };
            });

            return {
                id: cat.id,
                label: cat.name,
                color: cat.color ? `rgb(${cat.color})` : undefined,
                points,
            };
        });

        const payload = { period, series };

        const etag = sha(payload);
        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.set('ETag', etag);
        res.set('Cache-Control', 'private, max-age=60');
        res.json(payload);

    } catch (err) {
        next(err);
    }
});

export default router;