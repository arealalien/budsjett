// src/lib/cache.js
const TTL_DEFAULT = null; // null/undefined => never expires (FOREVER)
const MAX_ITEMS = 1000;

const store = new Map();     // key -> { val, exp:number|Infinity }
const inflight = new Map();  // key -> Promise
const now = () => Date.now();

export const FOREVER = null;

export function cacheGet(key) {
    const hit = store.get(key);
    if (!hit) return null;
    if (hit.exp < now()) { store.delete(key); return null; }
    return hit.val;
}

export async function cacheGetOrSet(key, ttl, fetcher) {
    // allow (key, fetcher) OR (key, ttl, fetcher)
    if (typeof ttl === 'function') { fetcher = ttl; ttl = TTL_DEFAULT; }

    const cached = cacheGet(key);
    if (cached != null) return cached;

    if (inflight.has(key)) return inflight.get(key);

    const p = (async () => {
        try {
            const val = await fetcher();
            cacheSet(key, val, ttl);
            return val;
        } finally {
            inflight.delete(key);
        }
    })();

    inflight.set(key, p);
    return p;
}

export function cacheSet(key, val, ttl = TTL_DEFAULT) {
    if (store.size > MAX_ITEMS) {
        const oldest = store.keys().next().value;
        if (oldest) store.delete(oldest);
    }
    const exp = (ttl == null) ? Infinity : (now() + ttl);
    store.set(key, { val, exp });
}

export function cacheDel(prefixOrKey) {
    for (const k of store.keys()) {
        if (k === prefixOrKey || k.startsWith(prefixOrKey)) store.delete(k);
    }
    for (const k of inflight.keys()) {
        if (k === prefixOrKey || k.startsWith(prefixOrKey)) inflight.delete(k);
    }
}
