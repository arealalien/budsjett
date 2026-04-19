import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { cacheGetOrSet } from '../lib/cache.js';

const router = Router();

const querySchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

const userName = (u) => u?.displayName ?? u?.username ?? 'Unknown';

const shapeUser = (u) => ({
    id: u?.id,
    name: userName(u),
    avatarUrl: u?.avatarUrl ?? null,
    avatarStorageKey: u?.avatarStorageKey ?? null,
    avatarUpdatedAt: u?.avatarUpdatedAt ?? null,
});

const keyBudgetInfo = (slug) => `budget:info:${slug}`;
const keyMembers = (budgetId) => `budget:${budgetId}:members:v3`;
const keyTotalsPaid = (budgetId, fromISO, toISO) =>
    `report:currentBalance:totalsPaid:${budgetId}:${fromISO || 'null'}:${toISO || 'null'}:v3`;
const keyDebts = (budgetId, fromISO, toISO) =>
    `report:currentBalance:debts:${budgetId}:${fromISO || 'null'}:${toISO || 'null'}:v3`;

function sha1(payload) {
    return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function buildSettlements(members) {
    const creditors = members
        .filter((m) => Number(m.netBalance) > 0.009)
        .map((m) => ({
            user: m.user,
            remaining: round2(m.netBalance),
        }))
        .sort((a, b) => b.remaining - a.remaining);

    const debtors = members
        .filter((m) => Number(m.netBalance) < -0.009)
        .map((m) => ({
            user: m.user,
            remaining: round2(m.netBalance),
        }))
        .sort((a, b) => a.remaining - b.remaining);

    const settlements = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
        const debtor = debtors[d];
        const creditor = creditors[c];

        const debtAmount = round2(Math.abs(debtor.remaining));
        const creditAmount = round2(creditor.remaining);
        const amount = round2(Math.min(debtAmount, creditAmount));

        if (amount > 0) {
            settlements.push({
                from: debtor.user,
                to: creditor.user,
                amount,
            });

            debtor.remaining = round2(debtor.remaining + amount);
            creditor.remaining = round2(creditor.remaining - amount);
        }

        if (Math.abs(debtor.remaining) < 0.01) d += 1;
        if (Math.abs(creditor.remaining) < 0.01) c += 1;
    }

    return settlements;
}

router.get('/:slug/reports/current-balance', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { dateFrom, dateTo } = querySchema.parse(req.query);

        const fromISO = dateFrom ? new Date(dateFrom).toISOString() : null;
        const toISO = dateTo ? endOfDay(dateTo).toISOString() : null;

        const budgetInfo = await cacheGetOrSet(keyBudgetInfo(slug), 60_000, async () => {
            const budget = await prisma.budget.findUnique({
                where: { slug },
                select: {
                    id: true,
                    members: { select: { userId: true } },
                },
            });

            if (!budget) return null;

            return {
                id: budget.id,
                memberIds: budget.members.map((m) => m.userId),
            };
        });

        if (!budgetInfo) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        const requesterId = req.user?.id;
        const isMember = requesterId && budgetInfo.memberIds.includes(requesterId);

        if (!isMember) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const paidAtFilter =
            dateFrom || dateTo
                ? {
                    paidAt: {
                        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                        ...(dateTo ? { lte: endOfDay(dateTo) } : {}),
                    },
                }
                : {};

        const totals = await cacheGetOrSet(
            keyTotalsPaid(budgetInfo.id, fromISO, toISO),
            60_000,
            async () => {
                const rows = await prisma.purchase.groupBy({
                    by: ['paidById'],
                    _sum: { amount: true },
                    where: {
                        budgetId: budgetInfo.id,
                        deletedAt: null,
                        ...paidAtFilter,
                    },
                });

                return rows.map((r) => ({
                    paidById: r.paidById,
                    amount: round2(Number(r._sum.amount || 0)),
                }));
            }
        );

        const debtsObj = await cacheGetOrSet(
            keyDebts(budgetInfo.id, fromISO, toISO),
            60_000,
            async () => {
                const Decimal = Prisma.Decimal;

                const shares = await prisma.purchaseShare.findMany({
                    where: {
                        isSettled: false,
                        OR: [
                            { fixedAmount: { not: null } },
                            { percent: { gt: 0 } },
                        ],
                        purchase: {
                            budgetId: budgetInfo.id,
                            deletedAt: null,
                            ...paidAtFilter,
                        },
                    },
                    select: {
                        userId: true,
                        fixedAmount: true,
                        percent: true,
                        purchase: {
                            select: {
                                amount: true,
                                paidById: true,
                            },
                        },
                    },
                });

                const debts = new Map();

                for (const s of shares) {
                    const debtorId = s.userId;
                    const payerId = s.purchase.paidById;

                    if (debtorId === payerId) continue;

                    const purchaseAmount = new Decimal(s.purchase.amount);

                    const rawBase =
                        s.fixedAmount != null
                            ? new Decimal(s.fixedAmount)
                            : purchaseAmount.abs().mul(s.percent).div(100);

                    const owedAmount = rawBase.abs();

                    const key = `${debtorId}__${payerId}`;
                    debts.set(key, (debts.get(key) || new Decimal(0)).add(owedAmount));
                }

                const out = {};
                for (const [k, v] of debts.entries()) {
                    out[k] = round2(v.toNumber());
                }

                return out;
            }
        );

        const users = await cacheGetOrSet(
            keyMembers(budgetInfo.id),
            5 * 60_000,
            async () => {
                return prisma.user.findMany({
                    where: { id: { in: budgetInfo.memberIds } },
                    select: {
                        id: true,
                        displayName: true,
                        username: true,
                        avatarUrl: true,
                        avatarStorageKey: true,
                        avatarUpdatedAt: true,
                    },
                });
            }
        );

        const userMap = new Map(users.map((u) => [u.id, u]));
        const totalsMap = new Map(totals.map((t) => [t.paidById, round2(t.amount)]));

        const incomingMap = new Map();
        const outgoingMap = new Map();

        for (const [key, amountRaw] of Object.entries(debtsObj)) {
            const amount = round2(Number(amountRaw || 0));
            const [debtorId, payerId] = key.split('__');

            outgoingMap.set(debtorId, round2((outgoingMap.get(debtorId) || 0) + amount));
            incomingMap.set(payerId, round2((incomingMap.get(payerId) || 0) + amount));
        }

        const members = budgetInfo.memberIds
            .map((userId) => {
                const user = userMap.get(userId);

                const totalPaidRaw = round2(totalsMap.get(userId) || 0);
                const totalPaid = round2(Math.abs(totalPaidRaw));

                const totalOwedToThem = round2(incomingMap.get(userId) || 0);
                const totalTheyOwe = round2(outgoingMap.get(userId) || 0);
                const netBalance = round2(totalOwedToThem - totalTheyOwe);

                return {
                    user: shapeUser(user || { id: userId, username: 'Unknown' }),
                    totalPaid,
                    totalOwedToThem,
                    totalTheyOwe,
                    netBalance,
                };
            })
            .sort((a, b) => {
                const byNet = b.netBalance - a.netBalance;
                if (byNet !== 0) return byNet;
                return b.totalPaid - a.totalPaid;
            });

        const settlements = buildSettlements(members);

        let netBetweenTwoUsers = null;
        if (members.length === 2) {
            if (settlements.length === 0) {
                netBetweenTwoUsers = {
                    from: members[0].user,
                    to: members[1].user,
                    amount: 0,
                };
            } else {
                const s = settlements[0];
                netBetweenTwoUsers = {
                    from: s.from,
                    to: s.to,
                    amount: round2(s.amount),
                };
            }
        }

        const payload = {
            filter: {
                dateFrom: fromISO,
                dateTo: toISO,
            },
            members,
            settlements,
            netBetweenTwoUsers,
            payers: members.map((m) => ({
                payer: m.user,
                totalPaid: m.totalPaid,
                owedToPayer: m.totalOwedToThem,
            })),
        };

        const etag = sha1(payload);
        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.set('Cache-Control', 'private, max-age=60');
        res.set('ETag', etag);
        res.json(payload);
    } catch (err) {
        next(err);
    }
});

export default router;