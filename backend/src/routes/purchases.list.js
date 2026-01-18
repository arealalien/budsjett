// routes/purchases.js
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import { cacheGetOrSet, cacheDel } from '../lib/cache.js';

const router = Router();

const TTL_LIST = null;

// ---------- validation ----------
const listSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(200).default(10),
    q: z.string().optional(),
    category: z.enum([
        'FURNITURE','GROCERIES','TAKEAWAY','RESTAURANT',
        'HOUSEHOLD','SUBSCRIPTIONS','OTHER'
    ]).optional(),
    shared: z.enum(['true','false']).optional(),
    paidById: z.string().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(['paidAt','amount','itemName','category']).default('paidAt'),
    sortDir: z.enum(['asc','desc']).default('desc'),
});

// ---------- helpers ----------
function sha1(obj) {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return crypto.createHash('sha1').update(json).digest('hex');
}

// Keep key space user-scoped and query-stable (dates normalized)
const keyForList = (userId, query) =>
    `purchases:list:u:${userId}:q:${sha1(query)}`;

// Small helper to shape one row for the client
function shapeRow(p) {
    return {
        id: p.id,
        itemName: p.itemName,
        amount: p.amount,
        paidAt: p.paidAt,
        shared: p.shared,
        notes: p.notes,
        category: p.category,
        paidBy: p.paidBy ? { id: p.paidBy.id, name: p.paidBy.name } : null,
        shares: p.shares.map(s => ({
            userId: s.userId,
            percent: s.percent,
            isSettled: s.isSettled,
            settledAt: s.settledAt,
            user: s.user ? { id: s.user.id, name: s.user.name } : null,
        })),
    };
}

// Strong 304 helper
function withEtag(req, res, payload, cacheSeconds = 60) {
    const etag = sha1(payload);
    if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return true;
    }
    res.set('Cache-Control', `private, max-age=${cacheSeconds}`);
    res.set('ETag', etag);
    res.json(payload);
    return false;
}

// Exportable invalidation for writers elsewhere
export function invalidatePurchasesListForUser(userId) {
    cacheDel(`purchases:list:u:${userId}:`);
}

// ---------- route ----------
router.get('/', verifyToken, async (req, res, next) => {
    try {
        const {
            page, pageSize, q, category, shared, paidById,
            dateFrom, dateTo, sortBy, sortDir,
        } = listSchema.parse(req.query);

        // Visibility: shared OR my personal (shared:false & I'm the payer)
        const visibilityWhere = {
            OR: [
                { shared: true },
                { AND: [{ shared: false }, { paidById: req.user.id }] },
            ],
        };

        const whereParts = [visibilityWhere];

        if (q) {
            whereParts.push({ itemName: { contains: q, mode: 'insensitive' } });
        }
        if (category) whereParts.push({ category });

        if (typeof dateFrom !== 'undefined' || typeof dateTo !== 'undefined') {
            whereParts.push({
                paidAt: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {}),
                },
            });
        }

        if (shared === 'true') whereParts.push({ shared: true });
        else if (shared === 'false') whereParts.push({ shared: false });

        if (paidById) whereParts.push({ paidById });

        const where = { AND: whereParts };

        // category is a scalar enum here, so direct orderBy is fine
        const orderBy = { [sortBy]: sortDir };

        // ---------- caching ----------
        const cacheKey = keyForList(req.user.id, {
            page, pageSize, q, category, shared, paidById,
            dateFrom: dateFrom ? dateFrom.toISOString() : null,
            dateTo:   dateTo   ? dateTo.toISOString()   : null,
            sortBy, sortDir,
        });

        const payload = await cacheGetOrSet(cacheKey, TTL_LIST, async () => {
            const [total, itemsRaw] = await Promise.all([
                prisma.purchase.count({ where }),
                prisma.purchase.findMany({
                    where,
                    orderBy,
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    select: {
                        id: true,
                        itemName: true,
                        amount: true,
                        paidAt: true,
                        shared: true,
                        notes: true,
                        category: true,
                        paidBy:   { select: { id: true, name: true } },
                        shares:   {
                            select: {
                                userId: true,
                                percent: true,
                                isSettled: true,
                                settledAt: true,
                                user: { select: { id: true, name: true } },
                            }
                        },
                    },
                }),
            ]);

            const items = itemsRaw.map(shapeRow);
            return { total, items };
        });

        if (withEtag(req, res, payload, 60)) return;
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

export default router;