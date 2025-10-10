import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { format } from 'date-fns';
import nb from 'date-fns/locale/nb';
import Loader from "./Loader";

const CATEGORIES_LABELS = {
    FURNITURE: 'Furniture',
    GROCERIES: 'Groceries',
    TAKEAWAY: 'Takeaway',
    RESTAURANT: 'Restaurant',
    HOUSEHOLD: 'Household',
    SUBSCRIPTIONS: 'Subscriptions',
    OTHER: 'Other',
};

const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const formatCurrencyParts = (value) => {
    const formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'EUR',
    });

    const parts = formatter.formatToParts(value);

    const symbol = parts.find(p => p.type === 'currency')?.value || '';
    const number = parts
        .filter(p => p.type !== 'currency')
        .map(p => p.value)
        .join('');

    return { symbol, number };
};

const fmtDateShort = (d) => {
    try {
        return format(new Date(d), 'd. MMMM yyyy', { locale: nb });
    } catch {
        return '';
    }
};

export default function CategoryTotals() {
    const [period, setPeriod] = useState('month'); // 'week' | 'month'
    const [data, setData] = useState({ items: [], grandTotal: 0, range: null });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const params = useMemo(() => ({ period }), [period]);
    const { symbol, number } = formatCurrencyParts(data.grandTotal);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                setLoading(true);
                setErr('');
                const { data } = await api.get('/reports/category-totals', { params, withCredentials: true });
                if (!ignore) setData(data);
            } catch (e) {
                if (!ignore) setErr(e.response?.data?.error || e.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [params]);

    return (
        <div className="dashboard-categoryblock">
            <div className="dashboard-categoryblock-rim"></div>
            <div className="dashboard-categoryblock-glow"></div>
            <div className="dashboard-categoryblock-inner">
                <div className="dashboard-categoryblock-inner-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h3 className="dashboard-categoryblock-inner-top-title">
                        <span className="currency-symbol">{symbol}</span>
                        {number}
                    </h3>
                    <div className="dashboard-categoryblock-inner-top-buttons">
                        <button className={period === 'week' ? 'active' : ''} type="button" onClick={() => setPeriod('week')} disabled={period === 'week'}>This week</button>
                        <button className={period === 'month' ? 'active' : ''} type="button" onClick={() => setPeriod('month')} disabled={period === 'month'}>This month</button>
                    </div>
                </div>

                {data?.range && (
                    <p className="dashboard-categoryblock-inner-date">
                        {fmtDateShort(data.range.from)} – {fmtDateShort(data.range.to)}
                    </p>
                )}

                <div className="dashboard-categoryblock-inner-center">
                    {loading ? (
                        <Loader/>
                    ) : err ? (
                        <p style={{ color: 'crimson' }}>{err}</p>
                    ) : (
                        <>
                            {data.items.length === 0 ? (
                                <p>No spending in this period.</p>
                            ) : (
                                <>
                                    {data.items.map(row => (
                                        <div className={"dashboard-categoryblock-inner-center-item " + row.category}>
                                            <h3 className="dashboard-categoryblock-inner-center-item-title">
                                                {CATEGORIES_LABELS[row.category] ?? row.category}
                                            </h3>
                                            <p className="dashboard-categoryblock-inner-center-item-subtitle">
                                                {fmtCurrency(row.total)}
                                            </p>
                                        </div>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
