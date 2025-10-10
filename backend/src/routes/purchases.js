import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const createPurchaseSchema = z.object({
    itemName: z.string().min(1).max(255),
    category: z.enum([
        'FURNITURE', 'GROCERIES', 'TAKEAWAY', 'RESTAURANT', 'HOUSEHOLD', 'SUBSCRIPTIONS', 'OTHER'
    ]),
    amount: z.number().positive(),
    paidAt: z.coerce.date().optional(),        // accepts ISO string or omitted (defaults to now)
    paidById: z.string().min(1),               // user id of the payer
    shared: z.boolean().default(true),
    splitPercentForPayer: z.number().min(0).max(100).optional(), // if shared, default 50
    notes: z.string().optional()
});

// POST /api/purchases
router.post('/', verifyToken, async (req, res, next) => {
    try {
        const {
            itemName, category, amount, paidAt, paidById, shared,
            splitPercentForPayer = 50, notes
        } = createPurchaseSchema.parse(req.body);

        // Ensure payer exists
        const payer = await prisma.user.findUnique({ where: { id: paidById }, select: { id: true } });
        if (!payer) return res.status(400).json({ error: 'Invalid paidById' });

        // Find “the other user” (assumes exactly two accounts exist)
        const users = await prisma.user.findMany({ select: { id: true } });
        if (users.length < 1) return res.status(400).json({ error: 'No users found' });
        const other = users.find(u => u.id !== paidById) || users[0]; // fallback if only one user

        // Build shares
        let sharesCreate;
        if (!shared) {
            // Personal: 100% to payer
            sharesCreate = [{ userId: paidById, percent: 100 }];
        } else {
            const p1 = Math.round(splitPercentForPayer);
            const p2 = 100 - p1;
            sharesCreate = [
                { userId: paidById, percent: p1 },
                { userId: other.id, percent: p2 }
            ];
        }

        const purchase = await prisma.purchase.create({
            data: {
                itemName,
                category,
                amount,                  // Prisma Decimal is fine with JS numbers; it will coerce
                paidAt: paidAt ?? new Date(),
                shared,
                notes: notes ?? null,
                paidById,
                createdById: req.user.id,
                shares: { create: sharesCreate }
            },
            include: {
                shares: { include: { user: { select: { id: true, name: true } } } },
                paidBy: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(purchase);
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

export default router;
