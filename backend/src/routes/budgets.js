import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// ---------- utils ----------
function slugify(s) {
    return (s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 100);
}

async function uniqueBudgetSlug(tx, base) {
    const root = slugify(base) || 'budget';
    let slug = root;
    let n = 1;
    while (await tx.budget.findUnique({ where: { slug } })) {
        slug = `${root}-${++n}`;
    }
    return slug;
}

function addInterval(date, recurrence, interval) {
    const d = new Date(date);
    const n = Math.max(1, Number(interval) || 1);
    if (recurrence === 'DAILY')   d.setDate(d.getDate() + n);
    if (recurrence === 'WEEKLY')  d.setDate(d.getDate() + 7 * n);
    if (recurrence === 'MONTHLY') d.setMonth(d.getMonth() + n);
    if (recurrence === 'YEARLY')  d.setFullYear(d.getFullYear() + n);
    return d;
}

const recurringSchema = z.object({
    recurrence: z.enum(['DAILY','WEEKLY','MONTHLY','YEARLY']),
    interval: z.coerce.number().int().min(1).default(1),
    startAt: z.coerce.date(),
    timeZone: z.string().min(1).max(50).default('UTC'),
}).optional();

// ---------- schemas ----------
const createBudgetSchema = z.object({
    name: z.string().min(1).max(191),
    // optional initial categories if you want to seed during creation
    categories: z
        .array(
            z.object({
                name: z.string().min(1).max(80),
                color: z.string().min(3).max(20), // "R, G, B"
                planMonthly: z.number().min(0).max(99999999.99).default(0),
            })
        )
        .optional(),
});

// All routes below require a logged-in user
router.use(verifyToken);

/**
 * GET /api/budgets
 * List all budgets the current user is a member of (owned + invited/joined)
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.userId; // set by verifyToken

        // Use membership table so we include both owned + joined
        const memberships = await prisma.budgetMember.findMany({
            where: { userId },
            include: {
                budget: {
                    include: {
                        owner: { select: { id: true, username: true, displayName: true } },
                        _count: { select: { members: true, categories: true, purchases: true } },
                    },
                },
            },
            orderBy: { joinedAt: 'desc' },
        });

        const result = memberships.map((m) => ({
            role: m.role,
            joinedAt: m.joinedAt,
            id: m.budget.id,
            name: m.budget.name,
            slug: m.budget.slug,
            owner: m.budget.owner,
            counts: {
                members: m.budget._count.members,
                categories: m.budget._count.categories,
                purchases: m.budget._count.purchases,
            },
            createdAt: m.budget.createdAt,
            updatedAt: m.budget.updatedAt,
        }));

        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/budgets
 * Create a new budget; caller becomes OWNER. Optionally seed categories.
 */
router.post('/', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { name, categories } = createBudgetSchema.parse(req.body);

        const budget = await prisma.$transaction(async (tx) => {
            const slug = await uniqueBudgetSlug(tx, name);

            const created = await tx.budget.create({
                data: {
                    name,
                    slug,
                    ownerId: userId,
                    members: { create: { userId, role: 'OWNER' } },
                },
                select: { id: true, name: true, slug: true },
            });

            if (Array.isArray(categories) && categories.length) {
                // prepare unique category slugs per budget
                const rows = categories.map((c, i) => ({
                    budgetId: created.id,
                    name: c.name.trim(),
                    slug: slugify(c.name),
                    color: c.color.trim(),
                    planMonthly: (c.planMonthly ?? 0).toFixed(2),
                    sortOrder: i,
                    isSystem: false,
                }));
                const seen = new Set();
                rows.forEach((r) => {
                    let base = r.slug || 'cat';
                    let k = base, n = 1;
                    while (seen.has(k)) k = `${base}-${++n}`;
                    r.slug = k;
                    seen.add(k);
                });
                await tx.category.createMany({ data: rows });
            }

            return created;
        });

        res.status(201).json(budget);
    } catch (err) {
        if (err?.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
        }
        next(err);
    }
});

/**
 * GET /api/budgets/:slug
 * Get one budget (only if the user is a member). Useful for your BudgetLayout.
 */
router.get('/:slug', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { slug } = req.params;

        const budget = await prisma.budget.findFirst({
            where: {
                slug,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } },
                ],
            },
            include: {
                owner: { select: { id: true, username: true, displayName: true } },
                members: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true } },
                    },
                    orderBy: { joinedAt: 'asc' },
                },
                categories: {
                    select: { id: true, name: true, slug: true, color: true, sortOrder: true },
                    orderBy: { sortOrder: 'asc' },
                },
                _count: { select: { members: true, categories: true, purchases: true } },
            },
        });

        if (!budget) {
            // Either the slug doesn't exist, or user isn't allowed to see it
            return res.status(404).json({ error: 'Budget not found' });
        }

        const myRole =
            budget.ownerId === userId
                ? 'OWNER'
                : (budget.members.find(m => m.userId === userId)?.role ?? 'MEMBER');

        res.json({
            id: budget.id,
            name: budget.name,
            slug: budget.slug,
            owner: budget.owner,
            counts: budget._count,
            members: budget.members.map(m => ({
                userId: m.userId,
                role: m.role,
                joinedAt: m.joinedAt,
                user: m.user,
            })),
            categories: budget.categories,
            createdAt: budget.createdAt,
            updatedAt: budget.updatedAt,
            role: myRole,
        });
    } catch (err) {
        next(err);
    }
});

const createPurchaseInBudgetSchema = z.object({
    itemName: z.string().min(1).max(191),
    categoryId: z.string().min(1),
    amount: z.number().positive(),
    paidAt: z.coerce.date().optional(),
    paidById: z.string().min(1).optional(),
    shared: z.boolean().optional(),
    splitPercentForPayer: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
    recurring: recurringSchema,
    sharesOverride: z.array(
        z.object({
            userId: z.string().min(1),
            percent: z.number().min(0).max(100),
        })
    ).optional(),
});

const createIncomeInBudgetSchema = z.object({
    itemName: z.string().min(1).max(191),
    amount: z.number().positive(),
    receivedAt: z.coerce.date().optional(),
    receivedById: z.string().min(1).optional(),
    notes: z.string().max(1000).optional(),
    recurring: recurringSchema, // same shape you already use
});

router.post('/:slug/purchases', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { slug } = req.params;

        const budget = await prisma.budget.findFirst({
            where: { slug, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            include: { members: true, categories: { select: { id: true } } },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const {
            itemName, categoryId, amount, paidAt, paidById: paidByIdRaw,
            shared: sharedRaw, splitPercentForPayer: splitRaw, notes, recurring, sharesOverride
        } = createPurchaseInBudgetSchema.parse(req.body);

        if (!budget.categories.some(c => c.id === categoryId))
            return res.status(400).json({ error: 'Invalid categoryId for this budget' });

        const memberIds = new Set([budget.ownerId, ...budget.members.map(m => m.userId)]);
        const paidById = paidByIdRaw || userId;
        if (!memberIds.has(paidById))
            return res.status(400).json({ error: 'paidById is not a member of this budget' });

        const allMemberIds = Array.from(memberIds);
        let shared = sharedRaw;
        if (allMemberIds.length === 1) shared = false;
        if (shared === undefined) shared = allMemberIds.length > 1;

        // build shares
        let sharesCreate = [];
        if (Array.isArray(sharesOverride) && sharesOverride.length) {
            // validate members & normalize to 100
                const rows = sharesOverride.map(s => {
                if (!memberIds.has(s.userId)) {
                    throw Object.assign(new Error('sharesOverride contains non-member'), { status: 400 });
                    }
                return { userId: s.userId, percent: Math.round(s.percent) };
                });
            let sum = rows.reduce((a, b) => a + b.percent, 0);
            if (sum !== 100 && rows.length) {
                const idx = rows.reduce((imax, r, i, arr) => r.percent > arr[imax].percent ? i : imax, 0);
                rows[idx].percent += (100 - sum);
                }
            sharesCreate = rows;
        } else if (!shared) {
            sharesCreate = [{ userId: paidById, percent: 100 }];
        } else if (allMemberIds.length === 2) {
            const otherId = allMemberIds.find(id => id !== paidById) || paidById;
            const p1 = Math.round(splitRaw ?? 50);
            const p2 = 100 - p1;
            sharesCreate = [
                { userId: paidById, percent: p1 },
                { userId: otherId,  percent: p2 },
            ];
        } else {
            const n = allMemberIds.length;
            const base = Math.floor(100 / n);
            let remainder = 100 - base * n;
            sharesCreate = allMemberIds.map(id => ({
                userId: id,
                percent: base + (remainder-- > 0 ? 1 : 0),
            }));
        }

        const result = await prisma.$transaction(async (tx) => {
            // create the actual purchase now
            const purchase = await tx.purchase.create({
                data: {
                    itemName,
                    amount,
                    paidAt: paidAt ?? new Date(),
                    shared,
                    notes: notes ?? null,
                    budget:   { connect: { id: budget.id } },
                    category: { connect: { id: categoryId } },
                    paidBy:   { connect: { id: paidById } },
                    createdBy:{ connect: { id: userId } },
                    shares: {
                        create: sharesCreate.map(s => ({
                            percent: s.percent,
                            user: { connect: { id: s.userId } },
                        })),
                    },
                },
                select: { id: true, itemName: true, amount: true, shared: true, paidAt: true },
            });

            // optionally create a RecurringRule for the future
            if (recurring) {
                const startAtUTC = recurring.startAt; // already parsed Date
                const firstNext =
                    startAtUTC > new Date() ? startAtUTC : addInterval(startAtUTC, recurring.recurrence, recurring.interval);

                await tx.recurringRule.create({
                    data: {
                        budgetId: budget.id,
                        kind: 'EXPENSE',
                        categoryId,
                        paidById,
                        itemName,
                        amount,
                        notes: notes ?? null,
                        recurrence: recurring.recurrence,
                        interval: recurring.interval,
                        timeZone: recurring.timeZone || 'UTC',
                        startAt: startAtUTC,
                        endAt: null,
                        nextRunAt: firstNext,
                        lastRunAt: null,
                        active: true,
                        createdById: userId,
                    },
                });
            }

            return purchase;
        });

        res.status(201).json(result);
    } catch (err) {
        if (err?.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

router.post('/:slug/income', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { slug } = req.params;

        const budget = await prisma.budget.findFirst({
            where: { slug, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            select: { id: true, ownerId: true, members: { select: { userId: true } } },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const {
            itemName, amount, receivedAt, receivedById: receivedByIdRaw, notes, recurring
        } = createIncomeInBudgetSchema.parse(req.body);

        const memberIds = new Set([budget.ownerId, ...budget.members.map(m => m.userId)]);
        const receivedById = receivedByIdRaw || userId;
        if (!memberIds.has(receivedById)) {
            return res.status(400).json({ error: 'receivedById is not a member of this budget' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create the income row
            const income = await tx.income.create({
                data: {
                    itemName,
                    amount,
                    receivedAt: receivedAt ?? new Date(),
                    notes: notes ?? null,
                    budget:   { connect: { id: budget.id } },
                    receivedBy:{ connect: { id: receivedById } },
                    createdBy: { connect: { id: userId } },
                },
                select: { id: true, itemName: true, amount: true, receivedAt: true },
            });

            // Optional recurring rule for INCOME
            if (recurring) {
                const startAtUTC = recurring.startAt; // zod already coerced to Date
                const firstNext =
                    startAtUTC > new Date()
                        ? startAtUTC
                        : addInterval(startAtUTC, recurring.recurrence, recurring.interval);

                await tx.recurringRule.create({
                    data: {
                        budgetId: budget.id,
                        kind: 'INCOME',
                        receivedById,
                        itemName,
                        amount,
                        notes: notes ?? null,
                        recurrence: recurring.recurrence,
                        interval: recurring.interval,
                        timeZone: recurring.timeZone || 'UTC',
                        startAt: startAtUTC,
                        endAt: null,
                        nextRunAt: firstNext,
                        lastRunAt: null,
                        active: true,
                        createdById: userId,
                    },
                });
            }

            return income;
        });

        res.status(201).json(result);
    } catch (err) {
        if (err?.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

router.post('/:slug/recurring/run-due-income', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { slug } = req.params;

        const budget = await prisma.budget.findFirst({
            where: { slug, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            select: { id: true },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const now = new Date();
        const rules = await prisma.recurringRule.findMany({
            where: {
                budgetId: budget.id,
                active: true,
                kind: 'INCOME',
                nextRunAt: { lte: now },
                OR: [{ endAt: null }, { endAt: { gte: now } }],
            },
            select: {
                id: true,
                receivedById: true,
                itemName: true,
                amount: true,
                notes: true,
                recurrence: true,
                interval: true,
                nextRunAt: true,
            },
        });

        const created = [];

        await prisma.$transaction(async (tx) => {
            for (const r of rules) {
                const income = await tx.income.create({
                    data: {
                        itemName: r.itemName,
                        amount: r.amount,
                        receivedAt: r.nextRunAt,
                        notes: r.notes ?? null,
                        budget: { connect: { id: budget.id } },
                        receivedBy: { connect: { id: r.receivedById } }, // ← no "!"
                        createdBy: { connect: { id: userId } },
                    },
                    select: { id: true },
                });
                created.push(income.id);

                const next = addInterval(r.nextRunAt, r.recurrence, r.interval);
                await tx.recurringRule.update({
                    where: { id: r.id },
                    data: { lastRunAt: r.nextRunAt, nextRunAt: next },
                });
            }
        });

        res.json({ createdCount: created.length, incomeIds: created });
    } catch (err) {
        next(err);
    }
});

const listInBudgetSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(200).default(10),
    q: z.string().optional(),
    categoryId: z.string().optional(),                // <-- note: categoryId now
    shared: z.enum(['true','false']).optional(),      // '', 'true', 'false'
    paidById: z.string().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(['paidAt','amount','itemName','category']).default('paidAt'),
    sortDir: z.enum(['asc','desc']).default('desc'),
});

// GET /api/budgets/:slug/purchases
router.get('/:slug/purchases', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { slug } = req.params;

        const {
            page, pageSize, q, categoryId, shared, paidById,
            dateFrom, dateTo, sortBy, sortDir,
        } = listInBudgetSchema.parse(req.query);

        // Find budget the user can access
        const budget = await prisma.budget.findFirst({
            where: { slug, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            select: { id: true, ownerId: true, members: { select: { userId: true } } },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        // visibility: shared OR personal-but-mine
        const visibilityWhere = {
            OR: [
                { shared: true },
                { AND: [{ shared: false }, { paidById: userId }] },
            ],
        };

        const whereParts = [
            { budgetId: budget.id },
            visibilityWhere,
        ];

        if (q) whereParts.push({ itemName: { contains: q, mode: 'insensitive' } });
        if (categoryId) whereParts.push({ categoryId });

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

        // sorting
        let orderBy;
        if (sortBy === 'category') {
            orderBy = { category: { name: sortDir } }; // relation sort
        } else {
            orderBy = { [sortBy]: sortDir };
        }

        const [total, items] = await Promise.all([
            prisma.purchase.count({ where }),
            prisma.purchase.findMany({
                where,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    category: { select: { id: true, name: true, slug: true, color: true } },
                    paidBy:   { select: { id: true, username: true, displayName: true } },
                    shares:   { include: { user: { select: { id: true, username: true, displayName: true } } } },
                },
            }),
        ]);

        // normalize a couple of fields for the frontend
        const shaped = items.map(p => ({
            id: p.id,
            itemName: p.itemName,
            amount: p.amount,
            paidAt: p.paidAt,
            shared: p.shared,
            notes: p.notes,
            paidBy: {
                id: p.paidBy?.id,
                name: p.paidBy?.displayName || p.paidBy?.username || '—',
            },
            category: p.category?.name || '—',
            shares: p.shares.map(s => ({
                userId: s.userId,
                percent: s.percent,
                isSettled: s.isSettled,
                settledAt: s.settledAt,
                user: {
                    id: s.user?.id,
                    name: s.user?.displayName || s.user?.username || s.userId,
                },
            })),
        }));

        res.json({ total, items: shaped });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

const updateMemberRoleSchema = z.object({
    role: z.enum(['ADMIN', 'MEMBER']), // can't set OWNER here
});

// helper
function roleOf(budget, userId) {
    if (budget.ownerId === userId) return 'OWNER';
    return budget.members.find(m => m.userId === userId)?.role ?? 'MEMBER';
}
function canManageRole(myRole, targetIsOwner, targetIsAdmin) {
    // OWNER can change anyone except OWNER role itself
    if (myRole === 'OWNER') return !targetIsOwner;
    // ADMINs cannot change OWNER or other ADMINs
    if (myRole === 'ADMIN') return !targetIsOwner && !targetIsAdmin;
    return false;
}
function canRemove(myRole, targetIsOwner, targetIsAdmin) {
    // OWNER can remove anyone except themselves (owner)
    if (myRole === 'OWNER') return !targetIsOwner;
    // ADMIN can only remove MEMBERs
    if (myRole === 'ADMIN') return !targetIsOwner && !targetIsAdmin;
    return false;
}

// PATCH /api/budgets/:slug/members/:userId  (change role)
router.patch('/:slug/members/:userId', async (req, res, next) => {
    try {
        const meId = req.user.id;
        const { slug, userId: targetId } = req.params;
        const { role } = updateMemberRoleSchema.parse(req.body);

        const budget = await prisma.budget.findFirst({
            where: {
                slug,
                OR: [{ ownerId: meId }, { members: { some: { userId: meId } } }],
            },
            include: {
                members: true,
            },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const myRole = roleOf(budget, meId);
        const targetMember = budget.members.find(m => m.userId === targetId);
        const targetIsOwner = budget.ownerId === targetId;
        const targetIsAdmin = targetMember?.role === 'ADMIN';

        if (!targetMember && !targetIsOwner) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (!canManageRole(myRole, targetIsOwner, targetIsAdmin)) {
            return res.status(403).json({ error: 'Not allowed to change this role' });
        }
        if (targetIsOwner) {
            return res.status(400).json({ error: 'Cannot change owner role' });
        }

        await prisma.budgetMember.update({
            where: { budgetId_userId: { budgetId: budget.id, userId: targetId } },
            data: { role },
        });

        // return fresh members list
        const members = await prisma.budgetMember.findMany({
            where: { budgetId: budget.id },
            include: { user: { select: { id: true, username: true, displayName: true } } },
            orderBy: { joinedAt: 'asc' },
        });
        res.json({
            members: members.map(m => ({
                userId: m.userId,
                role: m.role,
                joinedAt: m.joinedAt,
                user: m.user,
            })),
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

// DELETE /api/budgets/:slug/members/:userId  (remove member)
router.delete('/:slug/members/:userId', async (req, res, next) => {
    try {
        const meId = req.user.id;
        const { slug, userId: targetId } = req.params;

        const budget = await prisma.budget.findFirst({
            where: {
                slug,
                OR: [{ ownerId: meId }, { members: { some: { userId: meId } } }],
            },
            include: { members: true },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const myRole = roleOf(budget, meId);
        const targetMember = budget.members.find(m => m.userId === targetId);
        const targetIsOwner = budget.ownerId === targetId;
        const targetIsAdmin = targetMember?.role === 'ADMIN';

        if (!targetMember && !targetIsOwner) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (!canRemove(myRole, targetIsOwner, targetIsAdmin)) {
            return res.status(403).json({ error: 'Not allowed to remove this member' });
        }
        if (targetIsOwner) {
            return res.status(400).json({ error: 'Cannot remove the owner' });
        }

        await prisma.budgetMember.delete({
            where: { budgetId_userId: { budgetId: budget.id, userId: targetId } },
        });

        const members = await prisma.budgetMember.findMany({
            where: { budgetId: budget.id },
            include: { user: { select: { id: true, username: true, displayName: true } } },
            orderBy: { joinedAt: 'asc' },
        });
        res.json({
            members: members.map(m => ({
                userId: m.userId,
                role: m.role,
                joinedAt: m.joinedAt,
                user: m.user,
            })),
        });
    } catch (err) {
        next(err);
    }
});

router.post('/:slug/recurring/run-due', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { slug } = req.params;

        const budget = await prisma.budget.findFirst({
            where: { slug, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            select: {
                id: true,
                ownerId: true,
                members: { select: { userId: true } },
            },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const now = new Date();

        const rules = await prisma.recurringRule.findMany({
            where: {
                budgetId: budget.id,
                active: true,
                kind: 'EXPENSE',
                nextRunAt: { lte: now },
                OR: [{ endAt: null }, { endAt: { gte: now } }],
            },
            select: {
                id: true, categoryId: true, paidById: true,
                itemName: true, amount: true, notes: true,
                recurrence: true, interval: true,
                nextRunAt: true,
            },
        });

        const memberIds = new Set([budget.ownerId, ...budget.members.map(m => m.userId)]);
        const allMemberIds = Array.from(memberIds);

        const created = [];

        await prisma.$transaction(async (tx) => {
            for (const r of rules) {
                // Create purchase with equal split (or 100% payer if solo/two you can adapt)
                let shares = [];
                if (allMemberIds.length <= 1) {
                    shares = [{ userId: r.paidById, percent: 100 }];
                } else {
                    const n = allMemberIds.length;
                    const base = Math.floor(100 / n);
                    let rem = 100 - base * n;
                    shares = allMemberIds.map(id => ({
                        userId: id,
                        percent: base + (rem-- > 0 ? 1 : 0),
                    }));
                }

                const purchase = await tx.purchase.create({
                    data: {
                        itemName: r.itemName,
                        amount: r.amount,
                        paidAt: r.nextRunAt,      // run date
                        shared: allMemberIds.length > 1,
                        notes: r.notes ?? null,
                        budget:   { connect: { id: budget.id } },
                        category: { connect: { id: r.categoryId } },
                        paidBy:   { connect: { id: r.paidById } },
                        createdBy:{ connect: { id: userId } },
                        shares: {
                            create: shares.map(s => ({
                                percent: s.percent,
                                user: { connect: { id: s.userId } },
                            })),
                        },
                    },
                    select: { id: true },
                });

                created.push(purchase.id);

                // advance rule
                const next = addInterval(r.nextRunAt, r.recurrence, r.interval);
                await tx.recurringRule.update({
                    where: { id: r.id },
                    data: { lastRunAt: r.nextRunAt, nextRunAt: next },
                });
            }
        });

        res.json({ createdCount: created.length, purchaseIds: created });
    } catch (err) {
        next(err);
    }
});

export default router;
