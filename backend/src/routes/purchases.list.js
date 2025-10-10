import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

const listSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(200).default(10),
    q: z.string().optional(),
    category: z.enum(['FURNITURE','GROCERIES','TAKEAWAY','RESTAURANT','HOUSEHOLD','SUBSCRIPTIONS','OTHER']).optional(),
    shared: z.enum(['true','false']).optional(),    // '', 'true', 'false'
    paidById: z.string().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(['paidAt','amount','itemName','category']).default('paidAt'),
    sortDir: z.enum(['asc','desc']).default('desc'),
});

router.get('/', verifyToken, async (req, res, next) => {
    try {
        const {
            page, pageSize, q, category, shared, paidById,
            dateFrom, dateTo, sortBy, sortDir,
        } = listSchema.parse(req.query);

        // Visibility guard (applied to EVERY query):
        // - include all shared purchases
        // - include personal (shared: false) only if paidById is me
        const visibilityWhere = {
            OR: [
                { shared: true },
                { AND: [{ shared: false }, { paidById: req.user.id }] },
            ],
        };

        // User filters
        const whereParts = [visibilityWhere];

        if (q) {
            whereParts.push({
                itemName: { contains: q, mode: 'insensitive' },
            });
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

        if (shared === 'true') {
            whereParts.push({ shared: true });
        } else if (shared === 'false') {
            // personal only — but still only mine due to visibilityWhere
            whereParts.push({ shared: false });
        }

        if (paidById) {
            // If user is trying to look at someone else’s personals,
            // visibilityWhere already blocks them. No extra work needed.
            whereParts.push({ paidById });
        }

        const where = { AND: whereParts };

        const [total, items] = await Promise.all([
            prisma.purchase.count({ where }),
            prisma.purchase.findMany({
                where,
                orderBy: { [sortBy]: sortDir },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    paidBy: { select: { id: true, name: true } },
                    shares: { include: { user: { select: { id: true, name: true } } } },
                },
            }),
        ]);

        res.json({ total, items });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

export default router;