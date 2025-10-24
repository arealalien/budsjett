import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useParams, useOutletContext } from 'react-router-dom';
import Loader from '../Loader';

const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

export default function IncomeTotals() {
    const { slug } = useParams();
    const { budget } = useOutletContext?.() ?? {};

    const [rows, setRows] = useState([]);            // [{ user: {id, name}, totalIncome }]
    const [total, setTotal] = useState(0);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const params = useMemo(() => {
        const p = {};
        if (dateFrom) p.dateFrom = dateFrom;
        if (dateTo) p.dateTo = dateTo;
        return p;
    }, [dateFrom, dateTo]);

    useEffect(() => {
        if (!slug) return;
        let ignore = false;

        (async () => {
            try {
                setLoading(true);
                setErr('');
                const { data } = await api.get(
                    `/reports/${encodeURIComponent(slug)}/income-totals`,
                    { params, withCredentials: true }
                );
                if (ignore) return;
                setRows(data.rows || []);
                setTotal(data.totalIncome || 0);
            } catch (e) {
                if (!ignore) setErr(e.response?.data?.error || e.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();

        return () => { ignore = true; };
    }, [slug, params]);

    return (
        <div className="dashboard-balance">
            <div className="dashboard-balance-rim" />
            <div className="dashboard-balance-glow green" />
            <div className="dashboard-balance-inner">
                <div className="dashboard-balance-inner-top">
                    <h3 className="dashboard-balance-inner-top-title">Income</h3>
                    <div className="dashboard-balance-inner-top-filters">
                        <label>
                            <span className="sr-only">From</span>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="purchase-form-inner-grid-field-input"
                            />
                        </label>
                        <label>
                            <span className="sr-only">To</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="purchase-form-inner-grid-field-input"
                            />
                        </label>
                        {(dateFrom || dateTo) && (
                            <button
                                type="button"
                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="purchase-form-inner-grid-field-seg-btn"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <Loader />
                ) : err ? (
                    <p style={{ color: 'crimson' }}>{err}</p>
                ) : (
                    <>
                        <div className="dashboard-balance-inner-center">
                            {rows.length === 0 ? (
                                <p>No income recorded in this period.</p>
                            ) : (
                                rows.map((r) => (
                                    <div key={r.user.id} className="dashboard-balance-inner-center-list" style={{ width: '100%' }}>
                                        <div className="dashboard-balance-inner-center-block">
                                            <div className="dashboard-balance-inner-center-left">
                                                <p className="name">{r.user.name}</p>
                                            </div>
                                            <p className="amount">{fmtCurrency(r.totalIncome)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="dashboard-balance-inner-bottom">
                            <p>Total</p>
                            <p className="dashboard-balance-inner-bottom-green">{fmtCurrency(total)}</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
