import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const qSchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

const userName = (u) => u?.displayName ?? u?.username ?? 'Unknown';

router.get('/:slug/income-totals', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { dateFrom, dateTo } = qSchema.parse(req.query);
        const requesterId = req.userId;

        // 1) Load budget + members and verify access
        const budget = await prisma.budget.findUnique({
            where: { slug },
            select: {
                id: true,
                ownerId: true,
                members: { select: { userId: true } },
            },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const memberIds = new Set([budget.ownerId, ...budget.members.map(m => m.userId)]);
        if (!requesterId || !memberIds.has(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // 2) Fetch member display names
        const memberList = Array.from(memberIds);
        const users = await prisma.user.findMany({
            where: { id: { in: memberList } },
            select: { id: true, displayName: true, username: true },
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        // 3) Build optional date filter for incomes
        const receivedAtFilter =
            dateFrom || dateTo
                ? {
                    receivedAt: {
                        ...(dateFrom ? { gte: dateFrom } : {}),
                        ...(dateTo ? { lte: dateTo } : {}),
                    },
                }
                : {};

        // 4) Group income by receiver
        const grouped = await prisma.income.groupBy({
            by: ['receivedById'],
            _sum: { amount: true },
            where: {
                budgetId: budget.id,
                ...receivedAtFilter,
            },
        });

        // 5) Aggregate grand total
        const agg = await prisma.income.aggregate({
            _sum: { amount: true },
            where: {
                budgetId: budget.id,
                ...receivedAtFilter,
            },
        });

        // 6) Shape response — include members with zero income too
        const byUser = new Map(grouped.map(g => [g.receivedById, Number(g._sum.amount || 0)]));

        const rows = memberList
            .map(id => ({
                user: { id, name: userName(userMap.get(id)) },
                totalIncome: byUser.get(id) || 0,
            }))
            .sort((a, b) => b.totalIncome - a.totalIncome);

        res.json({
            rows,
            totalIncome: Number(agg._sum.amount || 0),
            dateFrom: dateFrom ? dateFrom.toISOString() : null,
            dateTo: dateTo ? dateTo.toISOString() : null,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
