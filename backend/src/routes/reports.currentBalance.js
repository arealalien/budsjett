// src/routes/reports.currentBalance.js
import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const querySchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

const userName = (u) => u?.displayName ?? u?.username ?? 'Unknown';

router.get('/:slug/reports/current-balance', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { dateFrom, dateTo } = querySchema.parse(req.query);

        // 1) Find budget + confirm membership
        const budget = await prisma.budget.findUnique({
            where: { slug },
            select: {
                id: true,
                members: { select: { userId: true } },
            },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const requesterId = req.user?.id;
        const memberIds = new Set(budget.members.map(m => m.userId));
        if (!requesterId || !memberIds.has(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const paidAtFilter =
            dateFrom || dateTo
                ? {
                    paidAt: {
                        ...(dateFrom ? { gte: dateFrom } : {}),
                        ...(dateTo ? { lte: dateTo } : {}),
                    },
                }
                : {};

        // 2) Sum full amounts paid by each payer in the period (within budget)
        const totals = await prisma.purchase.groupBy({
            by: ['paidById'],
            _sum: { amount: true },
            where: {
                budgetId: budget.id,
                deletedAt: null,
                ...paidAtFilter,
            },
        });

        // 3) Unsettled shares → who owes whom (within budget)
        const shares = await prisma.purchaseShare.findMany({
            where: {
                isSettled: false,
                percent: { gt: 0 },
                purchase: {
                    budgetId: budget.id,
                    deletedAt: null,
                    ...paidAtFilter,
                },
            },
            include: {
                user: {                       // debtor
                    select: { id: true, displayName: true, username: true },
                },
                purchase: {
                    select: {
                        id: true,
                        amount: true,
                        paidById: true,
                        paidBy: {                 // payer
                            select: { id: true, displayName: true, username: true },
                        },
                    },
                },
            },
        });

        // 4) Debts (debtor -> payer) using Decimal
        const Decimal = Prisma.Decimal;
        const debts = new Map(); // key: "debtorId__payerId" -> Decimal

        for (const s of shares) {
            const debtorId = s.user.id;
            const payerId  = s.purchase.paidById;
            if (debtorId === payerId) continue;

            const base =
                s.fixedAmount != null
                    ? new Decimal(s.fixedAmount)
                    : new Decimal(s.purchase.amount).mul(s.percent).div(100);

            const key = `${debtorId}__${payerId}`;
            debts.set(key, (debts.get(key) || new Decimal(0)).add(base));
        }

        // 5) Sum what is owed to each payer
        const owedToPayer = new Map(); // payerId -> Decimal
        for (const [key, amountDec] of debts.entries()) {
            const [, payerId] = key.split('__');
            owedToPayer.set(payerId, (owedToPayer.get(payerId) || new Decimal(0)).add(amountDec));
        }

        // 6) Fetch member names for display
        const memberIdList = Array.from(memberIds);
        const members = await prisma.user.findMany({
            where: { id: { in: memberIdList } },
            select: { id: true, displayName: true, username: true },
        });
        const userMap = new Map(members.map(u => [u.id, u]));

        // Union of payers who paid anything or are owed anything
        const allPayerIds = Array.from(
            new Set([
                ...totals.map(t => t.paidById),
                ...Array.from(owedToPayer.keys()),
            ])
        ).filter(id => memberIds.has(id)); // keep only budget members

        const payers = allPayerIds
            .map(payerId => {
                const u = userMap.get(payerId);
                const totalPaid = Number(totals.find(t => t.paidById === payerId)?._sum.amount ?? 0);
                const owedTo = Number((owedToPayer.get(payerId) || new Decimal(0)).toNumber());
                return {
                    payer: { id: payerId, name: userName(u) },
                    totalPaid,
                    owedToPayer: owedTo,
                };
            })
            .sort((a, b) => b.totalPaid - a.totalPaid);

        // 7) Net between two users (if the budget has exactly two members)
        let netBetweenTwoUsers = null;
        if (memberIds.size === 2) {
            const [u1, u2] = members; // exactly two
            const aToB = Number(debts.get(`${u1.id}__${u2.id}`)?.toNumber() ?? 0);
            const bToA = Number(debts.get(`${u2.id}__${u1.id}`)?.toNumber() ?? 0);

            const net = bToA - aToB; // positive => u2 owes u1
            if (net > 0) {
                netBetweenTwoUsers = {
                    from: { id: u2.id, name: userName(u2) },
                    to:   { id: u1.id, name: userName(u1) },
                    amount: net,
                };
            } else if (net < 0) {
                netBetweenTwoUsers = {
                    from: { id: u1.id, name: userName(u1) },
                    to:   { id: u2.id, name: userName(u2) },
                    amount: Math.abs(net),
                };
            } else {
                netBetweenTwoUsers = {
                    from: { id: u1.id, name: userName(u1) },
                    to:   { id: u2.id, name: userName(u2) },
                    amount: 0,
                };
            }
        }

        res.json({
            payers,
            netBetweenTwoUsers,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
