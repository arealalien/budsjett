import React, { useEffect, useMemo, useState, useId } from 'react';
import { api } from '../../lib/api';
import { LineChart, Line, AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import nb from 'date-fns/locale/nb';
import Loader from "../Loader";
import { useOutletContext, useParams } from 'react-router-dom';

const labelFor = (id, map) => (id === 'TOTAL' ? 'Total' : (map.get(id)?.name || id));
const fmtCurrency = n => (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const fmtTick = (iso, period) => {
    try {
        const d = parseISO(iso);
        if (period === 'year') return format(d, 'MMM yyyy', { locale: nb });
        return format(d, 'd MMM', { locale: nb });
    } catch { return ''; }
};

const asCssColor = (color) => {
    if (!color) return 'var(--accent)';
    const m = String(color).match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : color;
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
    const { slug } = useParams();
    const { budget } = useOutletContext();
    const [period, setPeriod] = useState('month');
    const [mode, setMode] = useState('single');

    // single-mode category uses IDs
    const [category, setCategory] = useState('TOTAL');

    // multiple-mode selection uses IDs
    const [selectedCats, setSelectedCats] = useState([]);
    const [combine, setCombine] = useState(false);

    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const uid = useId();

    const gradSingleId = `${uid}-area-total`;

    const gradIdFor = (key) => `${uid}-area-${key}`;

    const catList = useMemo(() => {
        const list = [{ id: 'TOTAL', name: 'Total', color: 'var(--accent)' }];
        for (const c of (budget?.categories || [])) {
            list.push({ id: c.id, name: c.name, color: asCssColor(c.color) });
        }
        return list;
    }, [budget]);

    const catMap = useMemo(() => {
        const m = new Map();
        catList.forEach(c => m.set(c.id, c));
        return m;
    }, [catList]);

    const rootAccent = '#8b5cf6';
    const selectedColor = useMemo(() => {
        if (mode === 'single' && category !== 'TOTAL') {
            return catMap.get(category)?.color || rootAccent;
        }
        return rootAccent;
    }, [mode, category, catMap]);

    const lineStroke = (key) => (catMap.get(key)?.color || rootAccent);

    const params = useMemo(() => {
        if (mode === 'single') {
            return { period, mode: 'single', category };
        }
        const base = {
            period,
            mode: 'multiple',
            categories: selectedCats.join(','),
        };
        return combine ? { ...base, combine: 'true' } : base;
    }, [period, mode, category, selectedCats, combine]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                setLoading(true); setErr('');
                const { data } = await api.get(`/budgets/${encodeURIComponent(slug)}/reports/spending-trend`, { params, withCredentials: true });
                if (!ignore) setData(data);
            } catch (e) {
                if (!ignore) setErr(e.response?.data?.error || e.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [slug, params]);

    const change = data?.change;
    const pct = change ? Math.abs(change.pct).toFixed(1) : null;
    const sign =
        change?.direction === 'even' ? '' :
            change?.direction === 'up'   ? '+' :
                change?.direction === 'down' ? '−'  : '';

    const changeColor =
        change?.direction === 'up'   ? 'trend-up' :
            change?.direction === 'down' ? 'trend-down' : 'trend-even';

    const { symbol, number } = useMemo(
        () => formatCurrencyParts(data?.currentTotal ?? 0),
        [data?.currentTotal]
    );

    const containerClass = mode === 'single'
        ? `dashboard-trend ${category === 'TOTAL' ? 'total' : 'cat'}`
        : `dashboard-trend multi`;

    const toggleCat = (id) =>
        setSelectedCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    useEffect(() => {
        if (mode === 'single') {
            setCombine(false);
        } else {
            setSelectedCats(prev => prev.filter(id => id !== 'TOTAL'));
        }
    }, [mode]);

    const mergedData = useMemo(() => {
        if (mode !== 'multiple' || !data || data.combine || !Array.isArray(data.series)) return null;
        const map = new Map();
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

    return (
        <div
            className={containerClass}
            style={{ '--accent': selectedColor }}
        >
            <div className="dashboard-trend-rim"></div>
            <div className="dashboard-trend-glow"></div>
            <div className="dashboard-trend-inner">
                <div className="dashboard-trend-inner-top">
                    <h3 className="dashboard-trend-inner-top-title">
                        Trend{mode === 'single' ? ` · ${labelFor(category, catMap)}` : (combine ? ' · Combined' : '')}
                    </h3>
                    <h3 className="dashboard-trend-inner-top-sum">
                        <span className="currency-symbol">{symbol}</span>
                        <span className="currency-amount">{number}</span>
                    </h3>
                </div>
                <div className="dashboard-trend-inner-buttons">
                    <button type="button" className={period==='week'  ? 'active' : ''} onClick={() => setPeriod('week')}>Week</button>
                    <button type="button" className={period==='month' ? 'active' : ''} onClick={() => setPeriod('month')}>Month</button>
                    <button type="button" className={period==='year'  ? 'active' : ''} onClick={() => setPeriod('year')}>Year</button>
                </div>
                <div className="dashboard-trend-inner-buttons">
                    <button type="button" className={mode==='single'   ? 'active' : ''} onClick={() => setMode('single')}>Single</button>
                    <button type="button" className={mode==='multiple' ? 'active' : ''} onClick={() => setMode('multiple')}>Multiple</button>
                </div>
                <div className="dashboard-trend-inner-dropdown">
                    {mode === 'single' ? (
                        <label>
                            <span>Category</span>
                            <select value={category} onChange={e=>setCategory(e.target.value)}>
                                {catList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </label>
                    ) : (
                        <div className="dashboard-trend-inner-dropdown-multi">
                            <span>Categories</span>
                            <div className="dashboard-trend-inner-dropdown-multi-buttons">
                                {catList.filter(c => c.id !== 'TOTAL').map(c => {
                                    const on = selectedCats.includes(c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`${on ? 'active' : ''}`}
                                            onClick={() => toggleCat(c.id)}
                                            style={{
                                                borderColor: c.color,
                                                background: on ? c.color : 'transparent'
                                            }}
                                        >
                                            {on ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12.121" height="12.121" viewBox="0 0 12.121 12.121">
                                                    <path d="M0,10,5,5M5,5l5-5M5,5l5,5M5,5,0,0" transform="translate(1.061 1.061)"
                                                          fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                                                </svg>
                                            ) : null}
                                            {c.name}
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
                                            <path d="M0,10,5,5M5,5l5-5M5,5l5,5M5,5,0,0" transform="translate(1.061 1.061)"
                                                  fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                                        </svg>
                                    ) : null}
                                    Combine
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="dashboard-trend-inner-center">
                    {loading ? (
                        <Loader/>
                    ) : err ? (
                        <p style={{ color:'crimson' }}>{err}</p>
                    ) : !data ? null : (
                        <div className="dashboard-trend-inner-center-graph" style={{ width:'100%', height:280 }}>
                            <ResponsiveContainer>
                                <AreaChart data={(mode === 'multiple' && !data.combine) ? mergedData : data.points}>
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

                                    <defs>
                                        {(mode === 'single' || (mode === 'multiple' && data.combine)) && (
                                            <linearGradient id={gradSingleId} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"  stopColor={selectedColor} stopOpacity={0.3} />
                                                <stop offset="100%" stopColor={selectedColor} stopOpacity={0} />
                                            </linearGradient>
                                        )}

                                        {mode === 'multiple' && !data.combine && Array.isArray(data.series) && data.series.map((s) => (
                                            <linearGradient key={s.key} id={gradIdFor(s.key)} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"  stopColor={lineStroke(s.key)} stopOpacity={0.3} />
                                                <stop offset="100%" stopColor={lineStroke(s.key)} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>

                                    {(mode === 'single' || (mode === 'multiple' && data.combine)) && (
                                        <Area
                                            type="monotone"
                                            dataKey="y"
                                            name={mode === 'single' ? labelFor(category, catMap) : 'Combined'}
                                            dot={false}
                                            stroke={selectedColor}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill={`url(#${gradSingleId})`}
                                            isAnimationActive={false}
                                        />
                                    )}

                                    {mode === 'multiple' && !data.combine && Array.isArray(data.series) && data.series.map((s) => (
                                        <Area
                                            key={s.key}
                                            type="monotone"
                                            dataKey={s.key}
                                            name={labelFor(s.key, catMap)}
                                            dot={false}
                                            stroke={lineStroke(s.key)}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill={`url(#${gradIdFor(s.key)})`}
                                            isAnimationActive={false}
                                            connectNulls
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

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