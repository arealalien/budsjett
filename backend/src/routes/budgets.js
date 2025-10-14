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
});

router.post('/:slug/purchases', async (req, res, next) => {
    try {
        const userId = req.userId;
        const { slug } = req.params;

        // Load budget with members & categories to validate everything in one shot
        const budget = await prisma.budget.findFirst({
            where: {
                slug,
                OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
            include: {
                members: true,
                categories: { select: { id: true } },
            },
        });

        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const {
            itemName,
            categoryId,
            amount,
            paidAt,
            paidById: paidByIdRaw,
            shared: sharedRaw,
            splitPercentForPayer: splitRaw,
            notes,
        } = createPurchaseInBudgetSchema.parse(req.body);

        // Validate category belongs to this budget
        const categoryOk = budget.categories.some(c => c.id === categoryId);
        if (!categoryOk) return res.status(400).json({ error: 'Invalid categoryId for this budget' });

        // Determine payer (default to current user)
        const paidById = paidByIdRaw || userId;

        // Validate payer is in this budget
        const memberIds = new Set([budget.ownerId, ...budget.members.map(m => m.userId)]);
        if (!memberIds.has(paidById)) {
            return res.status(400).json({ error: 'paidById is not a member of this budget' });
        }

        // Sharing rules
        const allMemberIds = Array.from(memberIds);
        let shared = sharedRaw;
        if (allMemberIds.length === 1) shared = false; // single-member budget ⇒ personal
        if (shared === undefined) shared = allMemberIds.length > 1; // default

        // Build shares
        let sharesCreate = [];
        if (!shared) {
            sharesCreate = [{ userId: paidById, percent: 100 }];
        } else if (allMemberIds.length === 2) {
            const otherId = allMemberIds.find(id => id !== paidById) || paidById;
            const p1 = Math.round(splitRaw ?? 50);
            const p2 = 100 - p1;
            sharesCreate = [
                { userId: paidById, percent: p1 },
                { userId: otherId, percent: p2 },
            ];
        } else {
            // 3+ members: equal split across all members
            const n = allMemberIds.length;
            const base = Math.floor(100 / n);
            let remainder = 100 - base * n;
            sharesCreate = allMemberIds.map(id => ({
                userId: id,
                percent: base + (remainder-- > 0 ? 1 : 0),
            }));
        }

        const purchase = await prisma.purchase.create({
            data: {
                itemName,
                amount,
                paidAt: paidAt ?? new Date(),
                shared,
                notes: notes ?? null,

                budget: { connect: { id: budget.id } },
                category: { connect: { id: categoryId } },
                paidBy: { connect: { id: paidById } },
                createdBy: { connect: { id: userId } },

                shares: {
                    create: sharesCreate.map(s => ({
                        percent: s.percent,
                        user: { connect: { id: s.userId } },
                    })),
                },
            },
            select: {
                id: true,
                itemName: true,
                amount: true,
                shared: true,
                paidAt: true,
            },
        });


        res.status(201).json(purchase);
    } catch (err) {
        if (err?.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
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

export default router;
