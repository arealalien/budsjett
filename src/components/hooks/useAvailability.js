import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';

// Simple in-memory cache to avoid refetching same value
const cache = new Map(); // key: `${field}:${value}` -> 'free' | 'taken'

export function useAvailability(field, rawValue, delay = 400) {
    const value = (rawValue || '').trim();
    const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'free' | 'taken' | 'error'
    const ctrlRef = useRef(null);

    // Unique key for this field+value
    const key = useMemo(() => `${field}:${value.toLowerCase()}`, [field, value]);

    useEffect(() => {
        // nothing entered => idle
        if (!value) {
            setStatus('idle');
            return;
        }

        // cached?
        const cached = cache.get(key);
        if (cached) {
            setStatus(cached);
            return;
        }

        // start debounced check
        setStatus('checking');

        if (ctrlRef.current) ctrlRef.current.abort();
        const ctrl = new AbortController();
        ctrlRef.current = ctrl;

        const t = setTimeout(async () => {
            try {
                const params = { [field]: value };
                const { data } = await api.get('/auth/availability', { params, signal: ctrl.signal });

                const isFree = data && data[field]; // backend returns true when FREE
                const next = isFree ? 'free' : 'taken';
                cache.set(key, next);
                setStatus(next);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                setStatus('error');
            }
        }, delay);

        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [key, field, value, delay]);

    return status;
}
