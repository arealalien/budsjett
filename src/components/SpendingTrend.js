// src/components/SpendingTrend.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import nb from 'date-fns/locale/nb';
import Loader from "./Loader";

const CATEGORIES = [
    'TOTAL',
    'FURNITURE','GROCERIES','TAKEAWAY','RESTAURANT','HOUSEHOLD','SUBSCRIPTIONS','OTHER'
];

const CATEGORY_LABELS = {
    TOTAL: 'Total',
    FURNITURE: 'Furniture',
    GROCERIES: 'Groceries',
    TAKEAWAY: 'Takeaway',
    RESTAURANT: 'Restaurant',
    HOUSEHOLD: 'Household',
    SUBSCRIPTIONS: 'Subscriptions',
    OTHER: 'Other',
};

const labelForCategory = c => CATEGORY_LABELS[c] ?? c;
const fmtCurrency = n => (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const fmtTick = (iso, period) => {
    try {
        const d = parseISO(iso);
        if (period === 'year') return format(d, 'MMM yyyy', { locale: nb });
        return format(d, 'd MMM', { locale: nb });
    } catch { return ''; }
};

const CAT_COLORS = {
    FURNITURE: '#3b82f6',
    GROCERIES: '#ef4444',
    TAKEAWAY: '#f59e0b',
    RESTAURANT: '#10b981',
    HOUSEHOLD: '#06b6d4',
    SUBSCRIPTIONS: '#a855f7',
    OTHER: '#64748b',
};

const TooltipContent = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    let when = '';
    try { when = format(parseISO(label), 'd. MMMM yyyy', { locale: nb }); } catch {}
    return (
        <div className="custom-tooltip">
            <div className="custom-tooltip-title">{when}</div>
            <div className="custom-tooltip-subtitle">
                {payload.map((p, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{
                display:'inline-block', width:10, height:10, borderRadius:9999,
                background: p.stroke || p.color || 'currentColor'
            }} />
                        <span>{p.name}: {fmtCurrency(p.value ?? 0)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const formatCurrencyParts = (value) => {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
    const parts = formatter.formatToParts(value);
    const symbol = parts.find(p => p.type === 'currency')?.value || '';
    const number = parts.filter(p => p.type !== 'currency').map(p => p.value).join('');
    return { symbol, number };
};

export default function SpendingTrend() {
    const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'year'
    const [mode, setMode] = useState('single');   // 'single' | 'multiple'

    // single-mode category
    const [category, setCategory] = useState('TOTAL');

    // multiple-mode selection
    const [selectedCats, setSelectedCats] = useState([]); // e.g. ['RESTAURANT','TAKEAWAY']
    const [combine, setCombine] = useState(false);

    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    // Build params for API — only include `combine` if true
    const params = useMemo(() => {
        if (mode === 'single') {
            return { period, mode: 'single', category };
        }
        const base = {
            period,
            mode: 'multiple',
            categories: selectedCats.join(','),
        };
        return combine ? { ...base, combine: 'true' } : base; // omit when false
    }, [period, mode, category, selectedCats, combine]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                setLoading(true); setErr('');
                const { data } = await api.get('/reports/spending-trend', { params, withCredentials: true });
                if (!ignore) setData(data);
            } catch (e) {
                if (!ignore) setErr(e.response?.data?.error || e.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [params]);

    // Bottom change
    const change = data?.change;
    const pct = change ? Math.abs(change.pct).toFixed(1) : null;
    const sign =
        change?.direction === 'even' ? '' :
            change?.direction === 'up'   ? '+' :
                change?.direction === 'down' ? '−'  : '';

    const changeColor =
        change?.direction === 'up'   ? 'trend-up' :
            change?.direction === 'down' ? 'trend-down' : 'trend-even';

    // Big number at top
    const { symbol, number } = useMemo(
        () => formatCurrencyParts(data?.currentTotal ?? 0),
        [data?.currentTotal]
    );

    // container class
    const catClass = (c) => (c || 'TOTAL').toLowerCase();
    const containerClass = mode === 'single'
        ? `dashboard-trend ${catClass(category)}`
        : `dashboard-trend multi`;

    // Helpers for multiple selector
    const toggleCat = (c) =>
        setSelectedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

    // keep selections sane across modes
    useEffect(() => {
        if (mode === 'single') {
            setCombine(false);
        } else {
            setSelectedCats(prev => prev.filter(c => c !== 'TOTAL'));
        }
    }, [mode]);

    // Merge series for multi-lines (one row with columns per category)
    const mergedData = useMemo(() => {
        if (mode !== 'multiple' || !data || data.combine || !Array.isArray(data.series)) return null;

        const map = new Map(); // x -> row { x, [CAT]: y }
        for (const s of data.series) {
            for (const pt of s.points) {
                const key = pt.x;
                const row = map.get(key) || { x: key };
                row[s.key] = pt.y;
                map.set(key, row);
            }
        }
        return Array.from(map.values()).sort((a, b) => new Date(a.x) - new Date(b.x));
    }, [mode, data]);

    const lineStroke = (key) => CAT_COLORS[key] || 'var(--accent)';

    return (
        <div className={containerClass}>
            <div className="dashboard-trend-rim"></div>
            <div className="dashboard-trend-glow"></div>
            <div className="dashboard-trend-inner">

                {/* Title & sum */}
                <div className="dashboard-trend-inner-top">
                    <h3 className="dashboard-trend-inner-top-title">
                        Trend{mode === 'single' ? ` · ${labelForCategory(category)}` : (combine ? ' · Combined' : '')}
                    </h3>
                    <h3 className="dashboard-trend-inner-top-sum">
                        <span className="currency-symbol">{symbol}</span>
                        <span className="currency-amount">{number}</span>
                    </h3>
                </div>

                {/* Period buttons */}
                <div className="dashboard-trend-inner-buttons">
                    <button type="button" className={period==='week'  ? 'active' : ''} onClick={() => setPeriod('week')}>Week</button>
                    <button type="button" className={period==='month' ? 'active' : ''} onClick={() => setPeriod('month')}>Month</button>
                    <button type="button" className={period==='year'  ? 'active' : ''} onClick={() => setPeriod('year')}>Year</button>
                </div>

                {/* Mode buttons */}
                <div className="dashboard-trend-inner-buttons">
                    <button type="button" className={mode==='single'   ? 'active' : ''} onClick={() => setMode('single')}>Single</button>
                    <button type="button" className={mode==='multiple' ? 'active' : ''} onClick={() => setMode('multiple')}>Multiple</button>
                </div>

                {/* Category controls */}
                <div className="dashboard-trend-inner-dropdown">
                    {mode === 'single' ? (
                        <label>
                            <span>Category</span>
                            <select value={category} onChange={e=>setCategory(e.target.value)}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{labelForCategory(c)}</option>)}
                            </select>
                        </label>
                    ) : (
                        <div className="dashboard-trend-inner-dropdown-multi">
                            <span>Categories</span>
                            <div className="dashboard-trend-inner-dropdown-multi-buttons">
                                {CATEGORIES.filter(c => c !== 'TOTAL').map(c => {
                                    const on = selectedCats.includes(c);
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            className={`${on ? 'active' : ''}`}
                                            onClick={() => toggleCat(c)}
                                            style={{
                                                borderColor: lineStroke(c),
                                                background: on ? lineStroke(c) : 'transparent'
                                            }}
                                        >
                                            {on ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12.121" height="12.121" viewBox="0 0 12.121 12.121">
                                                    <path id="Vector" d="M0,10,5,5M5,5l5-5M5,5l5,5M5,5,0,0" transform="translate(1.061 1.061)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                </svg>
                                            ) : (
                                                <></>
                                            )}
                                            {labelForCategory(c)}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="dashboard-trend-inner-dropdown-multi-combine">
                                <button
                                    type="button"
                                    className={`${combine ? 'active' : ''}`}
                                    onClick={() => setCombine(v => !v)}
                                    disabled={selectedCats.length <= 1}
                                >
                                    {combine ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12.121" height="12.121" viewBox="0 0 12.121 12.121">
                                            <path id="Vector" d="M0,10,5,5M5,5l5-5M5,5l5,5M5,5,0,0" transform="translate(1.061 1.061)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                        </svg>
                                    ) : (
                                        <></>
                                    )}
                                    Combine
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chart */}
                <div className="dashboard-trend-inner-center">
                    {loading ? (
                        <Loader/>
                    ) : err ? (
                        <p style={{ color:'crimson' }}>{err}</p>
                    ) : !data ? null : (
                        <div className="dashboard-trend-inner-center-graph" style={{ width:'100%', height:280 }}>
                            <ResponsiveContainer>
                                <LineChart data={(mode === 'multiple' && !data.combine) ? mergedData : data.points}>
                                    <XAxis
                                        dataKey="x"
                                        tickFormatter={(v) => fmtTick(v, data.period)}
                                        minTickGap={24}
                                        tickLine={false}
                                        axisLine={{ stroke: '#666' }}
                                        tick={{ fill: '#666', fontSize: 12 }}
                                        tickMargin={8}
                                    />
                                    <Tooltip content={<TooltipContent />} wrapperStyle={{ backdropFilter: 'blur(.5rem)', borderRadius: '1em' }} />

                                    {/* Single or Combined */}
                                    {(mode === 'single' || (mode === 'multiple' && data.combine)) && (
                                        <Line
                                            type="monotone"
                                            dataKey="y"
                                            name={mode === 'single' ? labelForCategory(category) : 'Combined'}
                                            dot={false}
                                            stroke="var(--accent)"
                                            strokeWidth={2}
                                            isAnimationActive={false}
                                        />
                                    )}

                                    {/* Multiple separate lines */}
                                    {mode === 'multiple' && !data.combine && Array.isArray(data.series) && data.series.map(s => (
                                        <Line
                                            key={s.key}
                                            type="monotone"
                                            dataKey={s.key}
                                            name={labelForCategory(s.key)}
                                            dot={false}
                                            stroke={lineStroke(s.key)}
                                            strokeWidth={2}
                                            isAnimationActive={false}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Bottom change */}
                <div className="dashboard-trend-inner-bottom">
                    {change && (
                        <h4 className={`trend-change ${changeColor}`}>
                            <span className="trend-sign">{sign}</span>
                            <span className="trend-value">{pct}</span>
                            <sup className="trend-percent">%</sup>
                        </h4>
                    )}
                </div>
            </div>
        </div>
    );
}