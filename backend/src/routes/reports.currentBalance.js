import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
// If you generate Prisma client to a custom path, keep this import:
import { Prisma } from '../../generated/prisma/index.js';
// If you use the default output, use this instead:
// import { Prisma } from '@prisma/client';

const router = Router();

const querySchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

router.get('/current-balance', verifyToken, async (req, res, next) => {
    try {
        const { dateFrom, dateTo } = querySchema.parse(req.query);

        const paidAtFilter =
            dateFrom || dateTo
                ? {
                    paidAt: {
                        ...(dateFrom ? { gte: dateFrom } : {}),
                        ...(dateTo ? { lte: dateTo } : {}),
                    },
                }
                : {};

        // A) Sum FULL amounts paid by each payer in the period
        const totals = await prisma.purchase.groupBy({
            by: ['paidById'],
            _sum: { amount: true },
            where: {
                deletedAt: null,
                ...paidAtFilter,
            },
        });

        // B) Get unsettled shares (who owes whom how much)
        const shares = await prisma.purchaseShare.findMany({
            where: {
                isSettled: false,
                percent: { gt: 0 },
                purchase: {
                    deletedAt: null,
                    ...paidAtFilter,
                },
            },
            include: {
                user: { select: { id: true, name: true } }, // debtor
                purchase: {
                    select: {
                        id: true,
                        amount: true,
                        paidById: true,
                        paidBy: { select: { id: true, name: true } }, // payer
                    },
                },
            },
        });

        // C) Build debts map: (debtor -> payer) -> amount
        const Decimal = Prisma.Decimal;
        const key = (debtorId, payerId) => `${debtorId}__${payerId}`;
        const debts = new Map(); // key -> Decimal amount

        for (const s of shares) {
            const debtorId = s.user.id;
            const payerId = s.purchase.paidById;
            if (debtorId === payerId) continue;

            const base =
                s.fixedAmount != null
                    ? new Decimal(s.fixedAmount)
                    : new Decimal(s.purchase.amount).mul(s.percent).div(100);

            const k = key(debtorId, payerId);
            debts.set(k, (debts.get(k) || new Decimal(0)).add(base));
        }

        // D) Convert debts to rows + also accumulate "owed to payer"
        const owedToPayer = new Map(); // payerId -> Decimal
        const pairs = [];

        for (const [k, amountDec] of debts.entries()) {
            const [debtorId, payerId] = k.split('__');
            pairs.push({
                debtorId,
                payerId,
                amount: amountDec.toNumber(),
            });
            owedToPayer.set(
                payerId,
                (owedToPayer.get(payerId) || new Decimal(0)).add(amountDec)
            );
        }

        // E) Gather payer/user info for display + attach totals and names
        const payerIdsFromTotals = totals.map(t => t.paidById);
        const payerIdsFromDebts = pairs.map(p => p.payerId);
        const allPayerIds = [...new Set([...payerIdsFromTotals, ...payerIdsFromDebts])];

        const users = await prisma.user.findMany({
            select: { id: true, name: true },
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        // Build "payers" array for UI with full paid and owed (optional)
        const payersSummary = allPayerIds.map(payerId => {
            const u = userMap.get(payerId) || { id: payerId, name: 'Unknown' };
            const totalPaid = Number(
                totals.find(t => t.paidById === payerId)?._sum.amount ?? 0
            );
            const owed = Number((owedToPayer.get(payerId) || new Decimal(0)).toNumber());
            return {
                payer: { id: u.id, name: u.name },
                totalPaid,
                // Keeping "amount" for unsettled owed-to-payer if you want to show it too
                amount: owed,
            };
        }).sort((a, b) => b.totalPaid - a.totalPaid);

        // F) Net between two users (if exactly two in system)
        let netBetweenTwoUsers = null;
        if (users.length === 2) {
            const [u1, u2] = users;
            const aToB =
                pairs.find(p => p.debtorId === u1.id && p.payerId === u2.id)?.amount ?? 0;
            const bToA =
                pairs.find(p => p.debtorId === u2.id && p.payerId === u1.id)?.amount ?? 0;

            const net = bToA - aToB; // positive => u2 owes u1
            if (net > 0) {
                netBetweenTwoUsers = { from: u2, to: u1, amount: net };
            } else if (net < 0) {
                netBetweenTwoUsers = { from: u1, to: u2, amount: Math.abs(net) };
            } else {
                netBetweenTwoUsers = { from: u1, to: u2, amount: 0 };
            }
        }

        res.json({
            // payersSummary: array per payer with full period total
            pairs: payersSummary,
            netBetweenTwoUsers,
        });
    } catch (err) {
        next(err);
    }
});

export default router;