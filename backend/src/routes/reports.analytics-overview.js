import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { CACHE_TAGS, cacheGetOrSet, makeCacheKey } from '../lib/cache.js';

const router = Router();

const querySchema = z.object({
    period: z.enum(['month', 'quarter', 'year', 'all']).default('year'),
    anchorDate: z.coerce.date().optional(),
});

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const userName = (user) => user?.displayName || user?.username || 'Unknown';

function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toCents(value) {
    return Math.round(Number(value || 0) * 100);
}

function fromCents(cents) {
    return round2((Number(cents) || 0) / 100);
}

function addCents(map, key, cents) {
    map.set(key, (map.get(key) || 0) + cents);
}

function addNestedCents(map, outerKey, innerKey, cents) {
    if (!map.has(outerKey)) map.set(outerKey, new Map());
    addCents(map.get(outerKey), innerKey, cents);
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function startOfMonth(date) {
    const d = startOfDay(date);
    d.setDate(1);
    return d;
}

function subtractMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() - months);
    return d;
}

function dateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function monthKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
}

function keyToDate(key) {
    return new Date(`${key}T00:00:00.000Z`);
}

function computeRange(period, anchor) {
    const today = endOfDay(anchor);

    if (period === 'all') return null;

    if (period === 'month') {
        return {
            from: startOfMonth(today),
            to: today,
        };
    }

    if (period === 'quarter') {
        return {
            from: startOfMonth(subtractMonths(today, 2)),
            to: today,
        };
    }

    return {
        from: startOfMonth(subtractMonths(today, 11)),
        to: today,
    };
}

function bucketModeForPeriod(period) {
    return period === 'month' ? 'day' : 'month';
}

function bucketKeyForDate(date, mode) {
    return mode === 'day' ? dateKey(date) : monthKey(date);
}

function buildBuckets(from, to, mode) {
    const buckets = [];
    const cursor = mode === 'day' ? startOfDay(from) : startOfMonth(from);
    const end = mode === 'day' ? startOfDay(to) : startOfMonth(to);

    while (cursor <= end) {
        const key = bucketKeyForDate(cursor, mode);
        buckets.push({ key, x: keyToDate(key) });

        if (mode === 'day') {
            cursor.setDate(cursor.getDate() + 1);
        } else {
            cursor.setMonth(cursor.getMonth() + 1);
        }
    }

    return buckets;
}

function splitCents(cents, count) {
    const safeCount = Math.max(1, count);
    const base = Math.trunc(cents / safeCount);
    const remainder = cents - (base * safeCount);

    return Array.from({ length: safeCount }, (_, index) => (
        base + (index < Math.abs(remainder) ? Math.sign(remainder) : 0)
    ));
}

function categoryIdsForPurchase(purchase) {
    const ids = [...new Set(
        (purchase.categories || [])
            .map((entry) => entry.categoryId)
            .filter(Boolean)
    )];

    if (!ids.length && purchase.categoryId) {
        ids.push(purchase.categoryId);
    }

    return ids;
}

function shareCentsForPurchase(purchaseCents, share) {
    if (share?.fixedAmount != null) {
        return Math.abs(toCents(share.fixedAmount));
    }

    return Math.round(Math.abs(purchaseCents) * (Number(share?.percent || 0) / 100));
}

function shapeUser(user, fallbackId) {
    return {
        id: user?.id || fallbackId,
        name: userName(user),
    };
}

function makeCategoryPayload(category, totalCents, myCents, count) {
    return {
        id: category.id,
        slug: category.slug,
        name: category.name,
        color: category.color,
        total: fromCents(totalCents),
        myResponsibility: fromCents(myCents),
        count: round2(count),
    };
}

router.get('/:slug/analytics-overview', verifyToken, async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { period, anchorDate } = querySchema.parse(req.query);
        const requesterId = req.userId || req.user?.id;
        const anchor = anchorDate || new Date();
        const range = computeRange(period, anchor);
        const bucketMode = bucketModeForPeriod(period);

        const budgetInfo = await cacheGetOrSet('budget-info', {
            key: { slug, route: 'analytics-overview' },
            ttl: 60_000,
            tags: [
                CACHE_TAGS.budgets,
                CACHE_TAGS.budgetSlug(slug),
            ],
            factory: async () => {
                const budget = await prisma.budget.findUnique({
                    where: { slug },
                    select: {
                        id: true,
                        ownerId: true,
                        members: { select: { userId: true } },
                    },
                });

                if (!budget) return null;

                return {
                    id: budget.id,
                    memberIds: [...new Set([budget.ownerId, ...budget.members.map((member) => member.userId)])],
                };
            },
        });

        if (!budgetInfo) return res.status(404).json({ error: 'Budget not found' });
        if (!requesterId || !budgetInfo.memberIds.includes(requesterId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const fromISO = range?.from ? range.from.toISOString() : 'all';
        const toISO = range?.to ? range.to.toISOString() : 'all';

        const payload = await cacheGetOrSet('reports:analytics-overview', {
            key: {
                budgetId: budgetInfo.id,
                requesterId,
                period,
                fromISO,
                toISO,
                bucketMode,
            },
            ttl: 60_000,
            tags: [
                CACHE_TAGS.reports,
                CACHE_TAGS.budget(budgetInfo.id),
                CACHE_TAGS.budgetReports(budgetInfo.id),
                CACHE_TAGS.budgetPurchases(budgetInfo.id),
                CACHE_TAGS.budgetCategories(budgetInfo.id),
                CACHE_TAGS.budgetMembers(budgetInfo.id),
                CACHE_TAGS.user(requesterId),
            ],
            factory: async () => {
                const purchaseDateFilter = range
                    ? { paidAt: { gte: range.from, lte: range.to } }
                    : {};

                const incomeDateFilter = range
                    ? { receivedAt: { gte: range.from, lte: range.to } }
                    : {};

                const [categories, users, purchases, incomes] = await Promise.all([
                    prisma.category.findMany({
                        where: { budgetId: budgetInfo.id },
                        select: { id: true, slug: true, name: true, color: true, sortOrder: true },
                        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                    }),
                    prisma.user.findMany({
                        where: { id: { in: budgetInfo.memberIds } },
                        select: { id: true, username: true, displayName: true },
                    }),
                    prisma.purchase.findMany({
                        where: {
                            budgetId: budgetInfo.id,
                            deletedAt: null,
                            ...purchaseDateFilter,
                        },
                        select: {
                            id: true,
                            itemName: true,
                            amount: true,
                            paidAt: true,
                            shared: true,
                            categoryId: true,
                            paidById: true,
                            categories: { select: { categoryId: true } },
                            shares: {
                                select: {
                                    userId: true,
                                    percent: true,
                                    fixedAmount: true,
                                },
                            },
                        },
                        orderBy: { paidAt: 'asc' },
                    }),
                    prisma.income.findMany({
                        where: {
                            budgetId: budgetInfo.id,
                            ...incomeDateFilter,
                        },
                        select: {
                            amount: true,
                            receivedAt: true,
                            receivedById: true,
                        },
                        orderBy: { receivedAt: 'asc' },
                    }),
                ]);

                const datedItems = [
                    ...purchases.map((purchase) => purchase.paidAt),
                    ...incomes.map((income) => income.receivedAt),
                ];

                const effectiveFrom = range?.from
                    || (datedItems.length ? startOfMonth(new Date(Math.min(...datedItems.map((date) => new Date(date).getTime())))) : startOfMonth(anchor));

                const effectiveTo = range?.to
                    || (datedItems.length ? endOfDay(new Date(Math.max(...datedItems.map((date) => new Date(date).getTime())))) : endOfDay(anchor));

                const buckets = buildBuckets(effectiveFrom, effectiveTo, bucketMode);
                const bucketLookup = new Set(buckets.map((bucket) => bucket.key));

                const userMap = new Map(users.map((user) => [user.id, user]));
                const memberRows = budgetInfo.memberIds.map((userId) => ({
                    user: shapeUser(userMap.get(userId), userId),
                    paidCents: 0,
                    responsibilityCents: 0,
                    incomeCents: 0,
                }));
                const memberMap = new Map(memberRows.map((member) => [member.user.id, member]));

                const categoryMap = new Map(categories.map((category) => [category.id, category]));
                const categoryTotals = new Map(categories.map((category) => [
                    category.id,
                    { totalCents: 0, myCents: 0, count: 0 },
                ]));
                const categoryBucketTotals = new Map();

                const totalByBucket = new Map();
                const myPaidByBucket = new Map();
                const myResponsibilityByBucket = new Map();
                const incomeByBucket = new Map();
                const purchaseCountByBucket = new Map();
                const weekdayRows = WEEKDAY_LABELS.map((label) => ({
                    label,
                    totalCents: 0,
                    myCents: 0,
                    count: 0,
                }));

                let totalSpendingCents = 0;
                let myPaidCents = 0;
                let myResponsibilityCents = 0;
                let totalIncomeCents = 0;
                let myIncomeCents = 0;
                let sharedSpendingCents = 0;
                let personalSpendingCents = 0;

                for (const purchase of purchases) {
                    const amountCents = toCents(purchase.amount);
                    const absoluteAmountCents = Math.abs(amountCents);
                    const bucketKey = bucketKeyForDate(purchase.paidAt, bucketMode);
                    const shares = purchase.shares?.length
                        ? purchase.shares
                        : [{ userId: purchase.paidById, percent: 100, fixedAmount: null }];
                    const categoryIds = categoryIdsForPurchase(purchase);
                    const categorySplits = splitCents(amountCents, categoryIds.length || 1);

                    totalSpendingCents += amountCents;
                    addCents(totalByBucket, bucketKey, amountCents);
                    addCents(purchaseCountByBucket, bucketKey, 1);

                    const paidMember = memberMap.get(purchase.paidById);
                    if (paidMember) paidMember.paidCents += amountCents;

                    if (purchase.paidById === requesterId) {
                        myPaidCents += amountCents;
                        addCents(myPaidByBucket, bucketKey, amountCents);
                    }

                    const isShared = purchase.shared && shares.filter((share) => shareCentsForPurchase(amountCents, share) > 0).length > 1;
                    if (isShared) {
                        sharedSpendingCents += amountCents;
                    } else {
                        personalSpendingCents += amountCents;
                    }

                    const weekdayIndex = (new Date(purchase.paidAt).getDay() + 6) % 7;
                    weekdayRows[weekdayIndex].totalCents += amountCents;
                    weekdayRows[weekdayIndex].count += 1;

                    for (const share of shares) {
                        const responsibilityCents = shareCentsForPurchase(absoluteAmountCents, share);
                        const responsibleMember = memberMap.get(share.userId);
                        if (responsibleMember) responsibleMember.responsibilityCents += responsibilityCents;

                        if (share.userId === requesterId) {
                            myResponsibilityCents += responsibilityCents;
                            addCents(myResponsibilityByBucket, bucketKey, responsibilityCents);
                            weekdayRows[weekdayIndex].myCents += responsibilityCents;
                        }
                    }

                    categoryIds.forEach((categoryId, index) => {
                        const category = categoryMap.get(categoryId);
                        if (!category) return;

                        const categoryCents = categorySplits[index] || 0;
                        const categoryState = categoryTotals.get(categoryId) || { totalCents: 0, myCents: 0, count: 0 };
                        categoryState.totalCents += categoryCents;
                        categoryState.count += 1 / Math.max(1, categoryIds.length);

                        addNestedCents(categoryBucketTotals, categoryId, bucketKey, categoryCents);

                        const myShare = shares.find((share) => share.userId === requesterId);
                        if (myShare) {
                            const myShareCents = shareCentsForPurchase(absoluteAmountCents, myShare);
                            const myCategorySplits = splitCents(myShareCents, categoryIds.length || 1);
                            categoryState.myCents += myCategorySplits[index] || 0;
                        }

                        categoryTotals.set(categoryId, categoryState);
                    });
                }

                for (const income of incomes) {
                    const amountCents = toCents(income.amount);
                    const bucketKey = bucketKeyForDate(income.receivedAt, bucketMode);

                    totalIncomeCents += amountCents;
                    addCents(incomeByBucket, bucketKey, amountCents);

                    const member = memberMap.get(income.receivedById);
                    if (member) member.incomeCents += amountCents;

                    if (income.receivedById === requesterId) {
                        myIncomeCents += amountCents;
                    }
                }

                const categoryItems = categories
                    .map((category) => {
                        const state = categoryTotals.get(category.id) || { totalCents: 0, myCents: 0, count: 0 };
                        return makeCategoryPayload(category, state.totalCents, state.myCents, state.count);
                    })
                    .sort((a, b) => {
                        const byTotal = b.total - a.total;
                        if (byTotal !== 0) return byTotal;
                        return a.name.localeCompare(b.name);
                    });

                const topCategoryIds = categoryItems
                    .filter((category) => Number(category.total) > 0)
                    .slice(0, 8)
                    .map((category) => category.id);

                const trend = buckets.map((bucket) => {
                    const totalCents = totalByBucket.get(bucket.key) || 0;
                    const count = purchaseCountByBucket.get(bucket.key) || 0;

                    return {
                        x: bucket.x,
                        totalSpending: fromCents(totalCents),
                        myPaid: fromCents(myPaidByBucket.get(bucket.key) || 0),
                        myResponsibility: fromCents(myResponsibilityByBucket.get(bucket.key) || 0),
                        totalIncome: fromCents(incomeByBucket.get(bucket.key) || 0),
                        purchaseCount: count,
                        avgPurchase: count ? fromCents(totalCents / count) : 0,
                    };
                });

                const categoryTrend = topCategoryIds.map((categoryId) => {
                    const category = categoryMap.get(categoryId);
                    const bucketMap = categoryBucketTotals.get(categoryId) || new Map();

                    return {
                        id: categoryId,
                        name: category?.name || 'Unknown',
                        color: category?.color || null,
                        points: buckets.map((bucket) => ({
                            x: bucket.x,
                            y: fromCents(bucketMap.get(bucket.key) || 0),
                        })),
                    };
                });

                const topPurchases = purchases
                    .slice()
                    .sort((a, b) => Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0)))
                    .slice(0, 10)
                    .map((purchase) => ({
                        id: purchase.id,
                        itemName: purchase.itemName,
                        amount: round2(Number(purchase.amount || 0)),
                        paidAt: purchase.paidAt,
                        paidBy: shapeUser(userMap.get(purchase.paidById), purchase.paidById),
                    }));

                const memberTotals = memberRows
                    .map((member) => ({
                        user: member.user,
                        paid: fromCents(member.paidCents),
                        responsibility: fromCents(member.responsibilityCents),
                        income: fromCents(member.incomeCents),
                    }))
                    .sort((a, b) => b.responsibility - a.responsibility);

                return {
                    period,
                    bucketMode,
                    range: {
                        from: effectiveFrom,
                        to: effectiveTo,
                    },
                    requester: shapeUser(userMap.get(requesterId), requesterId),
                    summary: {
                        totalSpending: fromCents(totalSpendingCents),
                        myPaid: fromCents(myPaidCents),
                        myResponsibility: fromCents(myResponsibilityCents),
                        totalIncome: fromCents(totalIncomeCents),
                        myIncome: fromCents(myIncomeCents),
                        netCashflow: fromCents(totalIncomeCents - totalSpendingCents),
                        myNetCashflow: fromCents(myIncomeCents - myResponsibilityCents),
                        sharedSpending: fromCents(sharedSpendingCents),
                        personalSpending: fromCents(personalSpendingCents),
                        purchaseCount: purchases.length,
                        avgPurchase: purchases.length ? fromCents(totalSpendingCents / purchases.length) : 0,
                    },
                    trend,
                    categories: categoryItems,
                    categoryTrend,
                    memberTotals,
                    sharedVsPersonal: [
                        { name: 'Shared', total: fromCents(sharedSpendingCents) },
                        { name: 'Personal', total: fromCents(personalSpendingCents) },
                    ],
                    weekday: weekdayRows.map((row) => ({
                        label: row.label,
                        total: fromCents(row.totalCents),
                        myResponsibility: fromCents(row.myCents),
                        count: row.count,
                    })),
                    topPurchases,
                };
            },
        });

        const etag = makeCacheKey(payload);
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
