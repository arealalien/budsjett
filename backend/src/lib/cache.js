import crypto from 'node:crypto';
import { BentoCache, bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';
import { redisDriver } from 'bentocache/drivers/redis';
import IORedis from 'ioredis';

const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes']);
const FALSE_VALUES = new Set(['0', 'false', 'off', 'no']);

const envFlag = (name, fallback) => {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;

    const value = String(raw).trim().toLowerCase();
    if (TRUE_VALUES.has(value)) return true;
    if (FALSE_VALUES.has(value)) return false;

    return fallback;
};

const envInt = (name, fallback) => {
    const value = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const envDuration = (name, fallback) => {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;

    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
};

const CACHE_PREFIX = process.env.CACHE_PREFIX || 'budsjett';
const CACHE_DRIVER = String(process.env.CACHE_DRIVER || '').trim().toLowerCase();
const CACHE_REDIS_URL = process.env.CACHE_REDIS_URL || process.env.REDIS_URL || '';
const CACHE_ENABLED = !FALSE_VALUES.has(String(process.env.CACHE_ENABLED || '').trim().toLowerCase()) && CACHE_DRIVER !== 'off';
const CACHE_DEBUG = envFlag('CACHE_DEBUG', false);
const CACHE_DEFAULT_TTL = envDuration('CACHE_DEFAULT_TTL', envInt('CACHE_DEFAULT_TTL_MS', 60_000));
const CACHE_DEFAULT_GRACE = envDuration('CACHE_DEFAULT_GRACE', '5m');
const CACHE_SOFT_TIMEOUT = envDuration('CACHE_SOFT_TIMEOUT', '750ms');
const CACHE_HARD_TIMEOUT = envDuration('CACHE_HARD_TIMEOUT', '10s');
const CACHE_LOCK_TIMEOUT = envDuration('CACHE_LOCK_TIMEOUT', '4s');
const CACHE_MEMORY_MAX_ITEMS = envInt('CACHE_MEMORY_MAX_ITEMS', envInt('CACHE_MAX_ITEMS', 2500));
const CACHE_MEMORY_MAX_SIZE = process.env.CACHE_MEMORY_MAX_SIZE || '128mb';
const CACHE_MEMORY_MAX_ENTRY_SIZE = process.env.CACHE_MEMORY_MAX_ENTRY_SIZE || '8mb';

let redisConnection = null;
let redisEnabled = false;

export const FOREVER = null;

export const CACHE_TAGS = {
    budgets: 'budgets',
    purchases: 'purchases',
    reports: 'reports',
    auth: 'auth',
    notifications: 'notifications',
    budget: (budgetId) => `budget:${budgetId}`,
    budgetSlug: (slug) => `budget-slug:${slug}`,
    budgetReports: (budgetId) => `budget:${budgetId}:reports`,
    budgetPurchases: (budgetId) => `budget:${budgetId}:purchases`,
    budgetCategories: (budgetId) => `budget:${budgetId}:categories`,
    budgetMembers: (budgetId) => `budget:${budgetId}:members`,
    user: (userId) => `user:${userId}`,
    userBudgets: (userId) => `user:${userId}:budgets`,
    userPurchases: (userId) => `user:${userId}:purchases`,
};

const metrics = {
    hits: 0,
    misses: 0,
    writes: 0,
    invalidations: 0,
    bypasses: 0,
    errors: 0,
};

function sortObject(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(sortObject);
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
        .sort()
        .reduce((out, key) => {
            out[key] = sortObject(value[key]);
            return out;
        }, {});
}

export function makeCacheKey(...parts) {
    const payload = parts.length === 1 ? sortObject(parts[0]) : sortObject(parts);
    const serialized = JSON.stringify(payload ?? null);
    const hash = crypto.createHash('sha1').update(serialized).digest('base64url');
    const label = String(parts[0] || 'key')
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

    return `${label || 'key'}:${hash}`;
}

function normalizeCacheKey(key) {
    return typeof key === 'string' ? key : makeCacheKey(key);
}

function normalizeTags(tags) {
    return [...new Set((Array.isArray(tags) ? tags : [tags]).filter(Boolean))];
}

function buildRedisConnection() {
    if (!CACHE_ENABLED) return null;
    if (CACHE_DRIVER !== 'redis' && !CACHE_REDIS_URL) return null;

    const redisOptions = {
        connectTimeout: envInt('CACHE_REDIS_CONNECT_TIMEOUT', 500),
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
    };

    const redis = CACHE_REDIS_URL
        ? new IORedis(CACHE_REDIS_URL, redisOptions)
        : new IORedis({
            ...redisOptions,
            host: process.env.CACHE_REDIS_HOST || '127.0.0.1',
            port: envInt('CACHE_REDIS_PORT', 6379),
            username: process.env.CACHE_REDIS_USERNAME || undefined,
            password: process.env.CACHE_REDIS_PASSWORD || undefined,
            db: Number.parseInt(process.env.CACHE_REDIS_DB || '0', 10) || 0,
        });

    redis.on('error', (error) => {
        metrics.errors += 1;
        console.warn('[cache] Redis connection error:', error?.message || error);
    });

    redisEnabled = true;
    return redis;
}

function buildStore() {
    const store = bentostore({
        ttl: CACHE_DEFAULT_TTL,
        grace: CACHE_DEFAULT_GRACE,
        timeout: CACHE_SOFT_TIMEOUT,
        hardTimeout: CACHE_HARD_TIMEOUT,
        lockTimeout: CACHE_LOCK_TIMEOUT,
        suppressL2Errors: true,
        onFactoryError: (error) => {
            metrics.errors += 1;
            console.warn('[cache] factory failed:', error?.message || error);
        },
    }).useL1Layer(memoryDriver({
        maxItems: CACHE_MEMORY_MAX_ITEMS,
        maxSize: CACHE_MEMORY_MAX_SIZE,
        maxEntrySize: CACHE_MEMORY_MAX_ENTRY_SIZE,
        serialize: true,
    }));

    redisConnection = buildRedisConnection();
    if (redisConnection) {
        store.useL2Layer(redisDriver({ connection: redisConnection }));
    }

    return store;
}

export const cache = new BentoCache({
    prefix: CACHE_PREFIX,
    default: 'app',
    stores: {
        app: buildStore(),
    },
});

function logCacheEvent(type, data = {}) {
    if (!CACHE_DEBUG) return;

    const key = String(data.key || '');
    const compactKey = key.length > 140 ? `${key.slice(0, 137)}...` : key;
    const layer = data.layer ? ` ${data.layer}` : '';
    const graced = data.graced ? ' stale' : '';
    console.debug(`[cache] ${type}${layer}${graced} ${compactKey}`);
}

if (CACHE_ENABLED) {
    cache.on('cache:hit', (data) => {
        metrics.hits += 1;
        logCacheEvent('hit', data);
    });
    cache.on('cache:miss', (data) => {
        metrics.misses += 1;
        logCacheEvent('miss', data);
    });
    cache.on('cache:written', (data) => {
        metrics.writes += 1;
        logCacheEvent('write', data);
    });
}

export async function cacheGetOrSet(namespace, options = {}, legacyFetcher) {
    if (typeof options === 'function' || typeof legacyFetcher === 'function') {
        throw new TypeError('cacheGetOrSet now requires cacheGetOrSet(namespace, { key, factory, tags })');
    }

    const {
        key,
        tags = [],
        ttl = CACHE_DEFAULT_TTL,
        grace = CACHE_DEFAULT_GRACE,
        factory,
        enabled = true,
    } = options;

    if (typeof factory !== 'function') {
        throw new TypeError('cacheGetOrSet requires a factory function');
    }

    const normalizedNamespace = String(namespace ?? '').trim();
    const normalizedKey = normalizeCacheKey(key ?? normalizedNamespace);

    if (!normalizedNamespace) {
        throw new TypeError('cacheGetOrSet requires a cache namespace');
    }

    if (!normalizedKey) {
        throw new TypeError('cacheGetOrSet requires a cache key');
    }

    if (!CACHE_ENABLED || !enabled) {
        metrics.bypasses += 1;
        return factory();
    }

    const cacheKey = `${normalizedNamespace}:${normalizedKey}`;
    const cacheTags = normalizeTags([`namespace:${normalizedNamespace}`, ...normalizeTags(tags)]);

    try {
        return await cache.getOrSet({
            key: cacheKey,
            tags: cacheTags,
            ttl,
            grace,
            factory: async (context) => {
                const value = await factory();
                if (typeof value === 'undefined') return context.skip();
                return value;
            },
        });
    } catch (error) {
        metrics.errors += 1;
        metrics.bypasses += 1;
        console.warn(`[cache] bypassed ${cacheKey}:`, error?.message || error);
        return factory();
    }
}

export async function invalidateCacheTags(tags = []) {
    const normalizedTags = normalizeTags(tags);
    if (!CACHE_ENABLED || normalizedTags.length === 0) return false;

    try {
        metrics.invalidations += 1;
        await cache.deleteByTag({ tags: normalizedTags, suppressL2Errors: true });
        if (CACHE_DEBUG) console.debug('[cache] invalidated tags:', normalizedTags.join(', '));
        return true;
    } catch (error) {
        metrics.errors += 1;
        console.warn('[cache] tag invalidation failed:', error?.message || error);
        return false;
    }
}

export function invalidateCacheTagsSoon(tags = []) {
    Promise.resolve()
        .then(() => invalidateCacheTags(tags))
        .catch((error) => {
            metrics.errors += 1;
            console.warn('[cache] async invalidation failed:', error?.message || error);
        });
}

export async function clearCacheNamespace(namespace) {
    if (!CACHE_ENABLED || !namespace) return false;
    return invalidateCacheTags([`namespace:${namespace}`]);
}

export async function cacheGet(key) {
    if (!CACHE_ENABLED || !key) return null;

    try {
        return await cache.get({ key, defaultValue: null, suppressL2Errors: true });
    } catch (error) {
        metrics.errors += 1;
        console.warn(`[cache] get failed ${key}:`, error?.message || error);
        return null;
    }
}

export async function cacheSet(key, value, ttl = CACHE_DEFAULT_TTL, { tags = [] } = {}) {
    if (!CACHE_ENABLED || !key || typeof value === 'undefined') return value;

    try {
        await cache.set({
            key,
            value,
            ttl,
            tags: normalizeTags(tags),
            suppressL2Errors: true,
        });
    } catch (error) {
        metrics.errors += 1;
        console.warn(`[cache] set failed ${key}:`, error?.message || error);
    }

    return value;
}

export function cacheDel(key) {
    if (!CACHE_ENABLED || !key) return false;

    Promise.resolve()
        .then(() => cache.delete({ key, suppressL2Errors: true }))
        .catch((error) => {
            metrics.errors += 1;
            console.warn(`[cache] delete failed ${key}:`, error?.message || error);
        });

    return true;
}

export function cacheStats() {
    return {
        engine: 'bentocache',
        enabled: CACHE_ENABLED,
        prefix: CACHE_PREFIX,
        driver: redisEnabled ? 'memory+redis' : 'memory',
        redis: redisEnabled,
        memoryMaxItems: CACHE_MEMORY_MAX_ITEMS,
        defaultTtl: CACHE_DEFAULT_TTL,
        defaultGrace: CACHE_DEFAULT_GRACE,
        metrics: { ...metrics },
    };
}
