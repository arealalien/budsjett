import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { format } from 'date-fns';
import nb from 'date-fns/locale/nb';
import Button from "./Button";
import Loader from "./Loader";

const fmtCurrency = (n) =>
    (Number.isFinite(n) ? n : Number(n))
        .toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const fmtDate = (isoOrDate) => {
    try {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        return format(d, 'd.M.yyyy', { locale: nb });
    } catch { return ''; }
};

const fmtDateCompact = (isoOrDate) => {
    try {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        return format(d, 'd. MMMM yyyy', { locale: nb });
    } catch { return ''; }
};

function applySettleLocal(row, nextValue) {
    const paidById = row.paidBy?.id;
    const shares = (row.shares || []).map(s => {
        if (paidById && s.userId !== paidById && s.percent > 0) {
            return { ...s, isSettled: nextValue, settledAt: nextValue ? new Date().toISOString() : null };
        }
        return s;
    });
    return { ...row, shares };
}

async function toggleSettle(purchaseId, nextValue, setRows) {
    await api.patch(`/purchases/${purchaseId}/settle`, { settled: nextValue }, { withCredentials: true });
    setRows(prev => prev.map(r => (r.id === purchaseId ? applySettleLocal(r, nextValue) : r)));
}

export default function PurchasesTable({ size = 'full' }) {
    const isCompact = size === 'compact';
    const { slug } = useParams();
    const { budget } = useOutletContext(); // contains owner, members, categories

    // Build users list (for Paid By filter)
    const users = useMemo(() => {
        const ids = new Set([budget.owner?.id, ...budget.members.map(m => m.userId)]);
        const arr = Array.from(ids).map(id => {
            const m = budget.members.find(x => x.userId === id);
            const u = m?.user || (budget.owner?.id === id ? budget.owner : null);
            return { id, name: u?.displayName || u?.username || id };
        });
        return arr;
    }, [budget]);

    // Categories for filter
    const categories = budget.categories || [];

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    // controls
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(isCompact ? 8 : 10);
    const [q, setQ] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [shared, setShared] = useState(''); // '', 'true', 'false'
    const [paidById, setPaidById] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortBy, setSortBy] = useState('paidAt');
    const [sortDir, setSortDir] = useState('desc');

    useEffect(() => setPageSize(isCompact ? 8 : 10), [isCompact]);

    const togglePaidBy = (current, nextId) => (current === nextId ? '' : nextId);
    const toggleShared = (current, nextVal) => (current === nextVal ? '' : nextVal);

    const params = useMemo(() => {
        const p = { page, pageSize, sortBy, sortDir };
        if (q.trim()) p.q = q.trim();
        if (categoryId) p.categoryId = categoryId;      // <-- categoryId
        if (shared) p.shared = shared;
        if (paidById) p.paidById = paidById;
        if (dateFrom) p.dateFrom = dateFrom;
        if (dateTo) p.dateTo = dateTo;
        return p;
    }, [page, pageSize, sortBy, sortDir, q, categoryId, shared, paidById, dateFrom, dateTo]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                setLoading(true);
                setErr('');
                const { data } = await api.get(`/budgets/${encodeURIComponent(slug)}/purchases`, {
                    params,
                    withCredentials: true,
                });
                if (!ignore) {
                    setRows(data.items || []);
                    setTotal(data.total || 0);
                }
            } catch (e) {
                if (!ignore) setErr(e.response?.data?.error || e.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [slug, params]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const onHeaderSort = (field) => {
        if (sortBy === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(field); setSortDir('asc'); }
    };

    const resetFilters = () => {
        setQ('');
        setCategoryId('');
        setShared('');
        setPaidById('');
        setDateFrom('');
        setDateTo('');
        setSortBy('paidAt');
        setSortDir('desc');
        setPage(1);
    };

    const eligibleRows = useMemo(() => {
        return rows.filter(r => {
            const paidById = r.paidBy?.id;
            const debtor = (r.shares || []).find(s => s.userId !== paidById && s.percent > 0);
            return r.shared && !!debtor;
        });
    }, [rows]);

    async function bulkSettle(nextValue) {
        if (!eligibleRows.length) return;
        const ids = new Set(eligibleRows.map(r => r.id));
        try {
            const requests = [...ids].map(id =>
                api.patch(`/purchases/${id}/settle`, { settled: nextValue }, { withCredentials: true })
            );
            const results = await Promise.allSettled(requests);
            setRows(prev => prev.map(r => (ids.has(r.id) ? applySettleLocal(r, nextValue) : r)));
            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length) alert(`${failures.length} item(s) failed to update. The rest were updated.`);
        } catch {}
    }

    return (
        <div className={`purchases-wrap ${isCompact ? 'compact' : ''}`}>
            {!isCompact && (
                <div className="purchases-wrap-filters">
                    <label className="purchases-wrap-filters-item">
                        <span>Search</span>
                        <input
                            className="purchases-wrap-filters-item-search"
                            value={q}
                            onChange={e=>{setQ(e.target.value); setPage(1);}}
                            placeholder="Item name…"
                        />
                    </label>

                    <label className="purchases-wrap-filters-item">
                        <span>Category</span>
                        <select
                            className="purchases-wrap-filters-item-select"
                            value={categoryId}
                            onChange={e=>{setCategoryId(e.target.value); setPage(1);}}
                        >
                            <option value="">All</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </label>

                    <div className="purchases-wrap-filters-item">
                        <span>Shared?</span>
                        <div className="purchases-wrap-filters-item-shared-toggle">
                            <button
                                type="button"
                                className={`toggle-btn ${shared === 'true' ? 'active' : ''}`}
                                aria-pressed={shared === 'true'}
                                onClick={() => { setShared(prev => toggleShared(prev, 'true')); setPage(1); }}
                                title="Shared"
                            >
                                {shared === 'true' ? <CheckIcon/> : null}
                                <span>Shared</span>
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${shared === 'false' ? 'active' : ''}`}
                                aria-pressed={shared === 'false'}
                                onClick={() => { setShared(prev => toggleShared(prev, 'false')); setPage(1); }}
                                title="Personal"
                            >
                                {shared === 'false' ? <CheckIcon/> : null}
                                <span>Personal</span>
                            </button>
                        </div>
                    </div>

                    {users.length === 2 ? (
                        <div className="purchases-wrap-filters-item">
                            <span>Paid by</span>
                            <div className="purchases-wrap-filters-item-paidby-toggle">
                                {users.map(u => {
                                    const active = paidById === u.id;
                                    return (
                                        <button
                                            key={u.id}
                                            type="button"
                                            className={`toggle-btn ${active ? 'active' : ''}`}
                                            aria-pressed={active}
                                            onClick={() => { setPaidById(prev => togglePaidBy(prev, u.id)); setPage(1); }}
                                            title={u.name}
                                        >
                                            {active ? <CheckIcon/> : null}
                                            <span>{u.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <label className="purchases-wrap-filters-item">
                            <span>Paid by</span>
                            <select
                                className="purchases-wrap-filters-item-select"
                                value={paidById}
                                onChange={e=>{ setPaidById(e.target.value); setPage(1); }}
                            >
                                <option value="">Anyone</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </label>
                    )}

                    <label className="purchases-wrap-filters-item">
                        <span>From</span>
                        <input className="purchases-wrap-filters-item-date" type="date"
                               value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setPage(1);}} />
                    </label>
                    <label className="purchases-wrap-filters-item">
                        <span>To</span>
                        <input className="purchases-wrap-filters-item-date" type="date"
                               value={dateTo} onChange={e=>{setDateTo(e.target.value); setPage(1);}} />
                    </label>

                    <label className="purchases-wrap-filters-item">
                        <span>Sort by</span>
                        <select className="purchases-wrap-filters-item-select" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                            <option value="paidAt">Date</option>
                            <option value="amount">Amount</option>
                            <option value="itemName">Item</option>
                            <option value="category">Category</option>
                        </select>
                    </label>
                    <label className="purchases-wrap-filters-item">
                        <span>Direction</span>
                        <select className="purchases-wrap-filters-item-select" value={sortDir} onChange={e=>setSortDir(e.target.value)}>
                            <option value="desc">Desc</option>
                            <option value="asc">Asc</option>
                        </select>
                    </label>
                    <label className="purchases-wrap-filters-item">
                        <span>Page size</span>
                        <select className="purchases-wrap-filters-item-select"
                                value={pageSize}
                                onChange={e=>{setPageSize(Number(e.target.value)); setPage(1);}}>
                            {[10,20,50,100].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>

                    <div className="purchases-wrap-filters-button">
                        <Button className="ba-purple" type="button" onClick={resetFilters}>Reset</Button>
                    </div>
                    <div className="purchases-wrap-filters-button">
                        <Button className="ba-gray" type="button"
                                disabled={eligibleRows.length === 0}
                                onClick={() => bulkSettle(true)}
                                title={eligibleRows.length ? `Settle ${eligibleRows.length} visible item(s)` : 'Nothing to settle'}>
                            Settle all visible
                        </Button>
                    </div>
                    <div className="purchases-wrap-filters-button">
                        <Button className="ba-gray" type="button"
                                disabled={eligibleRows.length === 0}
                                onClick={() => bulkSettle(false)}
                                title={eligibleRows.length ? `Unsettle ${eligibleRows.length} visible item(s)` : 'Nothing to unsettle'}>
                            Unsettle all visible
                        </Button>
                    </div>
                </div>
            )}

            <div className="purchases-wrap-table">
                <div className="purchases-wrap-table-rim"></div>
                <div className="purchases-wrap-table-glow"></div>
                <table className="purchases-wrap-table-inner">
                    <thead>
                    <tr>
                        <Th onClick={()=>onHeaderSort('paidAt')}   active={sortBy==='paidAt'}   dir={sortDir}>Date</Th>
                        <Th onClick={()=>onHeaderSort('itemName')} active={sortBy==='itemName'} dir={sortDir}>Item</Th>
                        <Th onClick={()=>onHeaderSort('category')} active={sortBy==='category'} dir={sortDir}>Category</Th>
                        <Th>Paid by</Th>
                        <Th onClick={()=>onHeaderSort('amount')}   active={sortBy==='amount'}   dir={sortDir} align="right">Amount</Th>
                        <Th>Shared</Th>
                        <Th>Notes</Th>
                        <Th>Settled</Th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading ? (
                        <tr><td colSpan={8} style={{padding:16}}><Loader/></td></tr>
                    ) : err ? (
                        <tr><td colSpan={8} style={{padding:16, color:'crimson'}}>{err}</td></tr>
                    ) : rows.length === 0 ? (
                        <tr><td colSpan={8} style={{padding:16}}>No purchases found</td></tr>
                    ) : rows.map(r => {
                        const paidByIdRow = r.paidBy?.id;
                        const debtor = (r.shares || []).find(s => s.userId !== paidByIdRow && s.percent > 0);
                        const isSettled = debtor?.isSettled ?? false;
                        const hasDebtor = !!debtor;

                        return (
                            <tr key={r.id}>
                                {!isCompact ? (
                                    <td className="date">{fmtDateCompact(r.paidAt)}</td>
                                ) : (
                                    <td className="date">{fmtDate(r.paidAt)}</td>
                                )}
                                <td>{r.itemName}</td>
                                <td className="category"><p>{r.category || '—'}</p></td>
                                <td className="paidBy"><p>{r.paidBy?.name ?? '—'}</p></td>
                                <td style={{ textAlign: 'right' }}>{fmtCurrency(Number(r.amount))}</td>
                                <td className="shared">{r.shared ? 'Yes' : 'No'}</td>
                                <td className="notes">{r.notes ? '📝' : '—'}</td>
                                <td>
                                    {r.shared && hasDebtor ? (
                                        <input
                                            className="check-purple"
                                            type="checkbox"
                                            checked={!!isSettled}
                                            onChange={async (e) => {
                                                try { await toggleSettle(r.id, e.target.checked, setRows); }
                                                catch (err) { alert(err.response?.data?.error || err.message); }
                                            }}
                                            title={debtor?.settledAt
                                                ? `Settled on ${fmtDate(debtor.settledAt)}`
                                                : 'Toggle settled state'}
                                        />
                                    ) : '—'}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {!isCompact && (
                <div className="purchases-wrap-pager">
                    <button className="purchases-wrap-pager-button" disabled={page<=1} onClick={()=>setPage(1)}>{'≪'}</button>
                    <button className="purchases-wrap-pager-button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))}>{'‹'}</button>
                    <span className="purchases-wrap-pager-text">Page {page} / {totalPages} • {total} items</span>
                    <button className="purchases-wrap-pager-button" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages, p+1))}>{'›'}</button>
                    <button className="purchases-wrap-pager-button" disabled={page>=totalPages} onClick={()=>setPage(totalPages)}>{'≫'}</button>
                </div>
            )}
        </div>
    );
}

function Th({ children, onClick, active, dir, align }) {
    return (
        <th
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : 'default', padding: 8, textAlign: align || 'left', whiteSpace: 'nowrap' }}
            title={onClick ? 'Sort' : undefined}
        >
            {children} {active ? (dir === 'asc' ? '▲' : '▼') : ''}
        </th>
    );
}

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12.121" height="12.121" viewBox="0 0 12.121 12.121">
            <path d="M0,10,5,5M5,5l5-5M5,5l5,5M5,5,0,0" transform="translate(1.061 1.061)"
                  fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
        </svg>
    );
}
