import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { format } from 'date-fns';
import nb from 'date-fns/locale/nb';
import Loader from "../Loader";
import { useParams } from 'react-router-dom';

const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const formatCurrencyParts = (value) => {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
    const parts = formatter.formatToParts(value);
    const symbol = parts.find(p => p.type === 'currency')?.value || '';
    const number = parts.filter(p => p.type !== 'currency').map(p => p.value).join('');
    return { symbol, number };
};

const fmtDateShort = (d) => {
    try { return format(new Date(d), 'd. MMMM yyyy', { locale: nb }); }
    catch { return ''; }
};

function getCategoryColors(color, opacity = 0.18) {
    if (!color) {
        return {
            border: 'rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)',
        };
    }

    const rgbMatch = String(color).match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    if (rgbMatch) {
        const [r, g, b] = rgbMatch.slice(1);
        return {
            border: `rgb(${r}, ${g}, ${b})`,
            background: `rgba(${r}, ${g}, ${b}, ${opacity})`,
        };
    }

    const hexMatch = String(color).match(/^#?([a-fA-F0-9]{6})$/);
    if (hexMatch) {
        const hex = hexMatch[1];
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return {
            border: `rgb(${r}, ${g}, ${b})`,
            background: `rgba(${r}, ${g}, ${b}, ${opacity})`,
        };
    }

    return {
        border: color,
        background: 'rgba(255,255,255,0.04)',
    };
}

export default function CategoryTotals() {
    const { slug } = useParams();
    const [period, setPeriod] = useState('month'); // 'week' | 'month'
    const [data, setData] = useState({ items: [], grandTotal: 0, range: null });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const params = useMemo(() => ({ period }), [period]);
    const { symbol, number } = formatCurrencyParts(data.grandTotal);

    useEffect(() => {
        if (!slug) return;
        let ignore = false;
        (async () => {
            try {
                setLoading(true);
                setErr('');
                const { data } = await api.get(
                    `/reports/${encodeURIComponent(slug)}/category-totals`,
                    { params, withCredentials: true }
                );
                if (!ignore) setData(data);
            } catch (e) {
                if (!ignore) setErr(e.response?.data?.error || e.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [slug, params]);

    return (
        <div className="dashboard-categoryblock">
            <div className="dashboard-categoryblock-rim"></div>
            <div className="dashboard-categoryblock-glow"></div>
            <div className="dashboard-categoryblock-inner">
                <div
                    className="dashboard-categoryblock-inner-top"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
                >
                    <h3 className="dashboard-categoryblock-inner-top-title">
                        <span className="currency-symbol">{symbol}</span>
                        {number}
                    </h3>
                    <div className="dashboard-categoryblock-inner-top-buttons">
                        <button
                            className={period === 'week' ? 'active' : ''}
                            type="button"
                            onClick={() => setPeriod('week')}
                            disabled={period === 'week'}
                        >
                            This week
                        </button>
                        <button
                            className={period === 'month' ? 'active' : ''}
                            type="button"
                            onClick={() => setPeriod('month')}
                            disabled={period === 'month'}
                        >
                            This month
                        </button>
                    </div>
                </div>

                {data?.range && (
                    <p className="dashboard-categoryblock-inner-date">
                        {fmtDateShort(data.range.from)} – {fmtDateShort(data.range.to)}
                    </p>
                )}

                <div className="dashboard-categoryblock-inner-center">
                    {loading ? (
                        <Loader />
                    ) : err ? (
                        <p style={{ color: 'crimson' }}>{err}</p>
                    ) : (
                        <>
                            {data.items.length === 0 ? (
                                <p>No categories found.</p>
                            ) : (
                                data.items.map((row) => {
                                    const { border, background } = getCategoryColors(row.color, 0.08);
                                    return (
                                        <div
                                            key={row.id}
                                            className="dashboard-categoryblock-inner-center-item"
                                            style={{
                                                backgroundColor: background,
                                                border: `1px solid ${border}`,
                                            }}
                                        >
                                            <h3 className="dashboard-categoryblock-inner-center-item-title">
                                                {row.name}
                                            </h3>
                                            <p className="dashboard-categoryblock-inner-center-item-subtitle" style={{
                                                color: border,
                                            }}>
                                                {fmtCurrency(row.total)}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}