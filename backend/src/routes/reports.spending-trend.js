import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const querySchema = z.object({
    period: z.enum(['week','month','year']).default('month'),
    mode: z.enum(['single','multiple']).default('single'),
    category: z.string().optional().default('TOTAL'), // categoryId or 'TOTAL'
    categories: z.string().optional(), // CSV of categoryIds
    combine: z.coerce.boolean().optional().default(false),
});

function keyForDate(d, step){
    if (step === 'month') {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildBuckets(from, to, step){
    const buckets = [];
    if (step === 'month'){
        const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
        const limit  = new Date(to.getFullYear(),   to.getMonth(),   1);
        while (cursor <= limit){
            buckets.push({ key: keyForDate(cursor, 'month'), date: new Date(cursor) });
            cursor.setMonth(cursor.getMonth()+1);
        }
    } else {
        let cursor = new Date(from); cursor.setHours(0,0,0,0);
        const limit = new Date(to);  limit.setHours(0,0,0,0);
        while (cursor <= limit){
            buckets.push({ key: keyForDate(cursor, 'day'), date: new Date(cursor) });
            cursor.setDate(cursor.getDate()+1);
        }
    }
    return buckets;
}

// budget-scoped
router.get('/:slug/reports/spending-trend', verifyToken, async (req, res, next) => {
    try {
        const { period, mode, category, categories, combine } = querySchema.parse(req.query);
        const userId = req.userId || req.user?.id; // depending on your auth middleware
        const { slug } = req.params;

        // Check access + get budget + categories
        const budget = await prisma.budget.findFirst({
            where: { slug, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            select: { id: true, categories: { select: { id: true, name: true } } },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const selectedIds = mode === 'multiple'
            ? (categories ? categories.split(',').map(s => s.trim()).filter(Boolean) : [])
            : (category === 'TOTAL' ? [] : [category]);

        // Validate that selected category IDs belong to this budget
        const budgetCatIds = new Set(budget.categories.map(c => c.id));
        if (selectedIds.some(id => !budgetCatIds.has(id))) {
            return res.status(400).json({ error: 'Invalid category in selection' });
        }

        const now = new Date();
        const { from, to, prevFrom, prevTo, step } = computeRanges(period, now);

        const whereCategory =
            mode === 'single' && category === 'TOTAL'
                ? {}
                : (selectedIds.length ? { categoryId: { in: selectedIds } } : {});

        // Pull once across both ranges for efficiency
        const purchases = await prisma.purchase.findMany({
            where: {
                budgetId: budget.id,
                deletedAt: null,
                paidAt: { gte: prevFrom, lte: to },
                ...whereCategory,
            },
            select: { amount: true, paidAt: true, categoryId: true },
            orderBy: { paidAt: 'asc' },
        });

        const buckets = buildBuckets(from, to, step);
        const curr = purchases.filter(p => p.paidAt >= from && p.paidAt <= to);
        const prev = purchases.filter(p => p.paidAt >= prevFrom && p.paidAt <= prevTo);

        // sum helper
        const sumFor = (items, ids) => {
            const filtered = ids?.length ? items.filter(p => p.categoryId && ids.includes(p.categoryId)) : items;
            return sumIntoBuckets(filtered, step);
        };

        if (mode === 'single') {
            const currByKey = sumFor(curr, selectedIds);
            const prevByKey = sumFor(prev, selectedIds);
            const points = toPerPeriodSeries(buckets, currByKey);

            const currentTotal = sumMap(currByKey);
            const previousTotal = sumMap(prevByKey);
            const change = buildChange(currentTotal, previousTotal);

            return res.json({
                mode, period, category, range: { from, to }, prevRange: { from: prevFrom, to: prevTo },
                points, currentTotal, previousTotal, change,
            });
        }

        // multiple
        if (combine) {
            const currByKey = sumFor(curr, selectedIds);
            const prevByKey = sumFor(prev, selectedIds);
            const points = toPerPeriodSeries(buckets, currByKey);

            const currentTotal = sumMap(currByKey);
            const previousTotal = sumMap(prevByKey);
            const change = buildChange(currentTotal, previousTotal);

            return res.json({
                mode, period, categories: selectedIds, combine: true,
                range: { from, to }, prevRange: { from: prevFrom, to: prevTo },
                points, currentTotal, previousTotal, change,
            });
        }

        // separate lines
        const series = selectedIds.map(id => {
            const currByKey = sumFor(curr, [id]);
            const prevByKey = sumFor(prev, [id]);
            const points = toPerPeriodSeries(buckets, currByKey);
            return {
                key: id,
                label: budget.categories.find(c => c.id === id)?.name || id,
                points,
                currentTotal: sumMap(currByKey),
                previousTotal: sumMap(prevByKey),
            };
        });

        const currentTotal = series.reduce((s, srs) => s + srs.currentTotal, 0);
        const previousTotal = series.reduce((s, srs) => s + srs.previousTotal, 0);
        const change = buildChange(currentTotal, previousTotal);

        return res.json({
            mode, period, categories: selectedIds, combine: false,
            range: { from, to }, prevRange: { from: prevFrom, to: prevTo },
            series, currentTotal, previousTotal, change,
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        next(err);
    }
});

export default router;

/* ---------- helpers (unchanged from your version) ---------- */
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d){ const x=startOfDay(d); const day=x.getDay(); const diff=(day===0?-6:1)-day; x.setDate(x.getDate()+diff); return x; }
function endOfWeek(d){ const s=startOfWeek(d); const e=new Date(s); e.setDate(e.getDate()+6); return endOfDay(e); }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return endOfDay(new Date(d.getFullYear(), d.getMonth()+1, 0)); }
function startOfYear(d){ return new Date(d.getFullYear(),0,1); }
function endOfYear(d){ return endOfDay(new Date(d.getFullYear(),11,31)); }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d, n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }

function computeRanges(period, now){
    let from, to, prevFrom, prevTo, step;
    if (period === 'week'){
        from = startOfWeek(now); to = endOfWeek(now);
        prevFrom = addDays(from, -7); prevTo = addDays(to, -7);
        step = 'day';
    } else if (period === 'month'){
        from = startOfMonth(now); to = endOfMonth(now);
        const prevStart = startOfMonth(addMonths(now, -1));
        const prevEnd = endOfMonth(addMonths(now, -1));
        prevFrom = prevStart; prevTo = prevEnd; step = 'day';
    } else {
        from = startOfYear(now); to = endOfYear(now);
        prevFrom = startOfYear(new Date(now.getFullYear()-1, now.getMonth(), now.getDate()));
        prevTo = endOfYear(new Date(now.getFullYear()-1, now.getMonth(), now.getDate()));
        step = 'month';
    }
    return { from, to, prevFrom, prevTo, step };
}

function sumIntoBuckets(purchases, step){
    const out = new Map();
    for (const p of purchases){
        const d = new Date(p.paidAt);
        const key = step === 'month'
            ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
            : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const amt = Number(p.amount) || 0;
        out.set(key, (out.get(key) || 0) + amt);
    }
    return out;
}

function toPerPeriodSeries(buckets, byKey){
    return buckets.map(b => {
        const y = +(byKey.get(b.key) || 0).toFixed(2);
        const x = b.key.length === 7 ? `${b.key}-01` : b.key;
        return { x, y };
    });
}

function sumMap(m){
    let s = 0;
    for (const v of m.values()) s += Number(v) || 0;
    return +s.toFixed(2);
}

function buildChange(currentTotal, previousTotal){
    const abs = currentTotal - previousTotal;
    const pct = previousTotal > 0 ? (abs / previousTotal) * 100 : (currentTotal > 0 ? 100 : 0);
    return { abs, pct, direction: abs === 0 ? 'even' : (abs > 0 ? 'up' : 'down') };
}