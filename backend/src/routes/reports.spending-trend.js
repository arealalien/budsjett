// src/routes/reports.spendingTrend.js
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { cacheGetOrSet, cacheDel } from '../lib/cache.js';

const router = Router();

const querySchema = z.object({
    period: z.enum(['week','month','year']).default('month'),
    mode: z.enum(['single','multiple']).default('single'),
    category: z.string().optional().default('TOTAL'),
    categories: z.string().optional(), // CSV of categoryIds
    combine: z.coerce.boolean().optional().default(false),
});

// ------------ small helpers ------------
const sha1 = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex');
const keyBudget = (slug) => `budget:${slug}:meta+cats:v1`;
const keyTrend = (slug, q) => `trend:${slug}:${q.period}:${q.mode}:${q.category || 'TOTAL'}:${q.categories || 'null'}:${q.combine ? '1' : '0'}:${q._fromISO}:${q._toISO}:${q._prevFromISO}:${q._prevToISO}:${q._step}`;

router.get('/:slug/reports/spending-trend', verifyToken, async (req, res, next) => {
    try {
        const { period, mode, category, categories, combine } = querySchema.parse(req.query);
        const userId = req.userId || req.user?.id;
        const { slug } = req.params;

        // ---- 1) auth + categories (cached) ----
        const budget = await cacheGetOrSet(keyBudget(slug), 60_000, async () => {
            const b = await prisma.budget.findFirst({
                where: { slug },
                select: {
                    id: true,
                    ownerId: true,
                    members: { select: { userId: true } },
                    categories: { select: { id: true, name: true } },
                },
            });
            if (!b) return null;
            return {
                id: b.id,
                ownerId: b.ownerId,
                memberIds: [b.ownerId, ...b.members.map(m => m.userId)],
                categories: b.categories,
            };
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });
        if (!userId || !new Set(budget.memberIds).has(userId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const selectedIds =
            mode === 'multiple'
                ? (categories ? categories.split(',').map(s => s.trim()).filter(Boolean) : [])
                : (category === 'TOTAL' ? [] : [category]);

        const budgetCatIds = new Set(budget.categories.map(c => c.id));
        if (selectedIds.some(id => !budgetCatIds.has(id))) {
            return res.status(400).json({ error: 'Invalid category in selection' });
        }

        // ---- 2) ranges + bucket granularity ----
        const now = new Date();
        const { from, to, prevFrom, prevTo, step } = computeRanges(period, now);
        const bucketExpr = step === 'month'
            ? `date_trunc('month', "paidAt")`
            : `date_trunc('day', "paidAt")`;

        // Save ISO strings for cache key stability
        const _fromISO = from.toISOString();
        const _toISO = to.toISOString();
        const _prevFromISO = prevFrom.toISOString();
        const _prevToISO = prevTo.toISOString();
        const _step = step;

        // ---- 3) main payload (cached per query tuple) ----
        const payload = await cacheGetOrSet(
            keyTrend(slug, { period, mode, category, categories, combine, _fromISO, _toISO, _prevFromISO, _prevToISO, _step }),
            60_000,
            async () => {
                // WHERE pieces (only our controlled fragments are interpolated)
                const whereBase = `"budgetId" = $1 AND "deletedAt" IS NULL`;
                const whereCurr = `${whereBase} AND "paidAt" >= $2 AND "paidAt" <= $3`;
                const wherePrev = `${whereBase} AND "paidAt" >= $4 AND "paidAt" <= $5`;
                const hasCats = selectedIds.length > 0;
                const catFilter = hasCats ? `AND "categoryId" = ANY($6)` : ``;

                // SQL builders
                const qAggregate = (whereClause) => `
          SELECT ${bucketExpr} AS bucket, SUM("amount")::numeric AS total
          FROM "Purchase"
          WHERE ${whereClause} ${catFilter}
          GROUP BY bucket
          ORDER BY bucket
        `;

                const qAggregateMulti = (whereClause) => `
          SELECT ${bucketExpr} AS bucket, "categoryId", SUM("amount")::numeric AS total
          FROM "Purchase"
          WHERE ${whereClause} ${catFilter}
          GROUP BY bucket, "categoryId"
          ORDER BY bucket
        `;

                // Parameter array (note: order matches $1..$6)
                const params = [budget.id, from, to, prevFrom, prevTo, ...(hasCats ? [selectedIds] : [])];

                if (mode === 'single' || combine) {
                    const [currRows, prevRows] = await Promise.all([
                        prisma.$queryRawUnsafe(qAggregate(whereCurr), ...params),
                        prisma.$queryRawUnsafe(qAggregate(wherePrev), ...params),
                    ]);

                    const buckets = buildBuckets(from, to, step);
                    const currMap = new Map(currRows.map(r => [toKey(r.bucket, step), Number(r.total)]));
                    const prevMap = new Map(prevRows.map(r => [toKey(r.bucket, step), Number(r.total)]));

                    const points = buckets.map(b => ({
                        x: toIso(b, step),
                        y: +(currMap.get(keyFor(b, step)) || 0).toFixed(2),
                    }));

                    const currentTotal = sumMap(currMap);
                    const previousTotal = sumMap(prevMap);
                    const change = buildChange(currentTotal, previousTotal);

                    return {
                        mode,
                        period,
                        ...(mode === 'single' ? { category } : { categories: selectedIds, combine: true }),
                        range: { from, to },
                        prevRange: { from: prevFrom, to: prevTo },
                        points,
                        currentTotal,
                        previousTotal,
                        change,
                    };
                } else {
                    // multiple + separate series
                    const rows = await prisma.$queryRawUnsafe(qAggregateMulti(whereCurr), ...params);

                    const seriesMap = new Map(); // catId -> Map(bucketKey -> total)
                    for (const r of rows) {
                        const catId = r.categoryId;
                        if (!seriesMap.has(catId)) seriesMap.set(catId, new Map());
                        seriesMap.get(catId).set(toKey(r.bucket, step), Number(r.total));
                    }

                    const buckets = buildBuckets(from, to, step);
                    const series = selectedIds.map(id => {
                        const m = seriesMap.get(id) || new Map();
                        const points = buckets.map(b => ({ x: toIso(b, step), y: +(m.get(keyFor(b, step)) || 0).toFixed(2) }));
                        const currentTotal = sumMap(m);
                        return {
                            key: id,
                            label: budget.categories.find(c => c.id === id)?.name || id,
                            points,
                            currentTotal,
                            previousTotal: 0, // add a prev aggregation if you later display per-series YoY/period deltas
                        };
                    });

                    const currentTotal = series.reduce((s, srs) => s + srs.currentTotal, 0);
                    const previousTotal = 0;
                    const change = buildChange(currentTotal, previousTotal);

                    return {
                        mode,
                        period,
                        categories: selectedIds,
                        combine: false,
                        range: { from, to },
                        prevRange: { from: prevFrom, to: prevTo },
                        series,
                        currentTotal,
                        previousTotal,
                        change,
                    };
                }
            }
        );

        // ---- 4) HTTP caching (ETag/304) ----
        const etag = sha1(payload);
        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }
        res.set('Cache-Control', 'private, max-age=60');
        res.set('ETag', etag);
        res.json(payload);
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
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

function keyFor(b, step){
    return step === 'month'
        ? `${b.date.getFullYear()}-${String(b.date.getMonth()+1).padStart(2,'0')}`
        : `${b.date.getFullYear()}-${String(b.date.getMonth()+1).padStart(2,'0')}-${String(b.date.getDate()).padStart(2,'0')}`;
}
function buildBuckets(from, to, step){
    const buckets = [];
    if (step === 'month'){
        const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
        const limit  = new Date(to.getFullYear(),   to.getMonth(),   1);
        while (cursor <= limit){ buckets.push({ date:new Date(cursor) }); cursor.setMonth(cursor.getMonth()+1); }
    } else {
        let cursor = new Date(from); cursor.setHours(0,0,0,0);
        const limit = new Date(to);  limit.setHours(0,0,0,0);
        while (cursor <= limit){ buckets.push({ date:new Date(cursor) }); cursor.setDate(cursor.getDate()+1); }
    }
    return buckets;
}
function toKey(ts, step){
    const d = new Date(ts);
    return step === 'month'
        ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toIso(b, step){
    const d = new Date(b.date);
    if (step === 'month') d.setDate(1);
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
}
function sumMap(m){ let s=0; for (const v of m.values()) s+=Number(v)||0; return +s.toFixed(2); }
function buildChange(currentTotal, previousTotal){
    const abs = currentTotal - previousTotal;
    const pct = previousTotal > 0 ? (abs / previousTotal) * 100 : (currentTotal > 0 ? 100 : 0);
    return { abs, pct, direction: abs === 0 ? 'even' : (abs > 0 ? 'up' : 'down') };
}