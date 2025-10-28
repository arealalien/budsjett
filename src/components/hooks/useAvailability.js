import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';

const cache = new Map();

export function useAvailability(field, rawValue, delay = 400, shouldCheck = () => true) {
    const value = (rawValue || '').trim();

    const [status, setStatus] = useState('idle');

    const ctrlRef = useRef(null);

    const norm = field === 'email' || field === 'username'
        ? value.toLowerCase()
        : value;

    const key = useMemo(() => `${field}:${norm}`, [field, norm]);

    useEffect(() => {
        if (!value) {
            setStatus('idle');
            return;
        }

        if (!shouldCheck(value)) {
            setStatus('invalid');
            return;
        }

        const cached = cache.get(key);
        if (cached) {
            setStatus(cached);
            return;
        }

        setStatus('checking');

        if (ctrlRef.current) ctrlRef.current.abort();
        const ctrl = new AbortController();
        ctrlRef.current = ctrl;

        const t = setTimeout(async () => {
            try {
                const params = { [field]: value };
                const { data } = await api.get('/auth/availability', { params, signal: ctrl.signal });
                const isFree = data && data[field];
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
    }, [key, field, value, delay, shouldCheck]);

    return status;
}