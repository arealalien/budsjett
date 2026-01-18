// src/routes/reports.currentBalance.js
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { cacheGetOrSet, cacheDel } from '../lib/cache.js';

const router = Router();

const querySchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

const userName = (u) => u?.displayName ?? u?.username ?? 'Unknown';

// ---------- cache keys ----------
const keyBudgetInfo = (slug) => `budget:info:${slug}`; // -> { id, memberIds[] }
const keyMembers    = (budgetId) => `budget:${budgetId}:members:v1`; // -> [{id,displayName,username}]
const keyTotalsPaid = (budgetId, fromISO, toISO) =>
    `report:currentBalance:totalsPaid:${budgetId}:${fromISO || 'null'}:${toISO || 'null'}`;
const keyDebts = (budgetId, fromISO, toISO) =>
    `report:currentBalance:debts:${budgetId}:${fromISO || 'null'}:${toISO || 'null'}`;

// Small helper for ETag
function sha1(payload) {
    return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

router.get('/:slug/reports/current-balance', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { dateFrom, dateTo } = querySchema.parse(req.query);

        // Normalize window once for stable cache keys
        const fromISO = dateFrom ? new Date(dateFrom).toISOString() : null;
        const toISO   = dateTo   ? new Date(dateTo).toISOString()   : null;

        // 1) Budget + membership (cached)
        const budgetInfo = await cacheGetOrSet(keyBudgetInfo(slug), 60_000, async () => {
            const b = await prisma.budget.findUnique({
                where: { slug },
                select: { id: true, members: { select: { userId: true } } },
            });
            if (!b) return null;
            return { id: b.id, memberIds: b.members.map((m) => m.userId) };
        });
        if (!budgetInfo) return res.status(404).json({ error: 'Budget not found' });

        const requesterId = req.user?.id;
        const isMember = requesterId && budgetInfo.memberIds.includes(requesterId);
        if (!isMember) return res.status(403).json({ error: 'Forbidden' });

        // Build paidAt filter once
        const paidAtFilter =
            dateFrom || dateTo
                ? {
                    paidAt: {
                        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                        ...(dateTo ? { lte: new Date(dateTo) } : {}),
                    },
                }
                : {};

        // 2) Totals paid by payer (cached per window)
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
                // Return plain array to keep ETag stable
                return rows.map((r) => ({
                    paidById: r.paidById,
                    amount: Number(r._sum.amount || 0),
                }));
            }
        );

        // 3) Unsettled shares → aggregated debts (cached per window)
        //    We cache a flattened “debtor__payer -> amount(number)” object.
        const debtsObj = await cacheGetOrSet(
            keyDebts(budgetInfo.id, fromISO, toISO),
            60_000,
            async () => {
                const Decimal = Prisma.Decimal;
                const shares = await prisma.purchaseShare.findMany({
                    where: {
                        isSettled: false,
                        percent: { gt: 0 },
                        purchase: {
                            budgetId: budgetInfo.id,
                            deletedAt: null,
                            ...paidAtFilter,
                        },
                    },
                    select: {
                        userId: true,              // debtorId
                        fixedAmount: true,
                        percent: true,
                        purchase: {
                            select: {
                                amount: true,
                                paidById: true,        // payerId
                            },
                        },
                    },
                });

                const debts = new Map(); // "debtor__payer" -> Decimal
                for (const s of shares) {
                    const debtorId = s.userId;
                    const payerId = s.purchase.paidById;
                    if (debtorId === payerId) continue;

                    const base =
                        s.fixedAmount != null
                            ? new Decimal(s.fixedAmount)
                            : new Decimal(s.purchase.amount).mul(s.percent).div(100);

                    const key = `${debtorId}__${payerId}`;
                    debts.set(key, (debts.get(key) || new Decimal(0)).add(base));
                }

                const out = {};
                for (const [k, v] of debts.entries()) out[k] = Number(v.toNumber());
                return out;
            }
        );

        // 4) Member names for display (cached)
        const members = await cacheGetOrSet(
            keyMembers(budgetInfo.id),
            5 * 60_000,
            async () => {
                const ids = budgetInfo.memberIds;
                const rows = await prisma.user.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, displayName: true, username: true },
                });
                return rows;
            }
        );
        const userMap = new Map(members.map((u) => [u.id, u]));

        // 5) Build "owed to payer" from debtsObj
        const owedToPayer = new Map(); // payerId -> number
        for (const [key, amount] of Object.entries(debtsObj)) {
            const [, payerId] = key.split('__');
            owedToPayer.set(payerId, (owedToPayer.get(payerId) || 0) + Number(amount || 0));
        }

        // 6) Union of payers that either paid or are owed
        const totalsMap = new Map(totals.map((t) => [t.paidById, t.amount]));
        const allPayerIds = Array.from(
            new Set([
                ...totals.map((t) => t.paidById),
                ...owedToPayer.keys(),
            ])
        ).filter((id) => budgetInfo.memberIds.includes(id));

        const payers = allPayerIds
            .map((payerId) => {
                const u = userMap.get(payerId);
                const totalPaid = Number(totalsMap.get(payerId) || 0);
                const owedTo = Number(owedToPayer.get(payerId) || 0);
                return {
                    payer: { id: payerId, name: userName(u) },
                    totalPaid,
                    owedToPayer: owedTo,
                };
            })
            .sort((a, b) => b.totalPaid - a.totalPaid);

        // 7) Net between two users (only if exactly two members)
        let netBetweenTwoUsers = null;
        if (budgetInfo.memberIds.length === 2) {
            const [id1, id2] = budgetInfo.memberIds;
            const u1 = userMap.get(id1);
            const u2 = userMap.get(id2);
            const aToB = Number(debtsObj[`${id1}__${id2}`] || 0);
            const bToA = Number(debtsObj[`${id2}__${id1}`] || 0);
            const net = bToA - aToB; // positive => u2 owes u1
            if (net > 0) {
                netBetweenTwoUsers = {
                    from: { id: id2, name: userName(u2) },
                    to:   { id: id1, name: userName(u1) },
                    amount: net,
                };
            } else if (net < 0) {
                netBetweenTwoUsers = {
                    from: { id: id1, name: userName(u1) },
                    to:   { id: id2, name: userName(u2) },
                    amount: Math.abs(net),
                };
            } else {
                netBetweenTwoUsers = {
                    from: { id: id1, name: userName(u1) },
                    to:   { id: id2, name: userName(u2) },
                    amount: 0,
                };
            }
        }

        const payload = { payers, netBetweenTwoUsers };

        // ETag/304 + response caching headers
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