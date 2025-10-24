import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Loader from "../Loader";
import { useParams, useOutletContext } from 'react-router-dom';

const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

export default function CurrentBalance() {
    // budget comes from your layout (same as your other pages)
    const { slug } = useParams();
    const { budget } = useOutletContext?.() ?? {};

    const [rows, setRows] = useState([]);          // renamed from pairs → clearer for UI list
    const [net, setNet] = useState(null);
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
                    `/reports/${encodeURIComponent(slug)}/reports/current-balance`,
                    { params, withCredentials: true }
                );
                if (ignore) return;
                setRows(data.payers ?? []);
                setNet(data.netBetweenTwoUsers ?? null);
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
            {net && (net.amount === 0
                    ? <div className="dashboard-balance-glow green" />
                    : <div className="dashboard-balance-glow red" />
            )}
            <div className="dashboard-balance-rim" />
            <div className="dashboard-balance-inner">
                <div className="dashboard-balance-inner-top">
                    <h3 className="dashboard-balance-inner-top-title">Current balance</h3>
                </div>

                {loading ? (
                    <Loader />
                ) : err ? (
                    <p style={{ color: 'crimson' }}>{err}</p>
                ) : (
                    <>
                        <div className="dashboard-balance-inner-center">
                            {rows.length === 0 ? (
                                <p>No unsettled debts 🎉</p>
                            ) : (
                                rows.map((r) => (
                                    <div key={r.payer.id} className="dashboard-balance-inner-center-list" style={{ width: '100%' }}>
                                        <div className="dashboard-balance-inner-center-block">
                                            <div className="dashboard-balance-inner-center-left">
                                                <p className="name">{r.payer.name} — paid in period:</p>
                                            </div>
                                            <p className="amount">{fmtCurrency(r.totalPaid)}</p>
                                        </div>
                                        <div className="dashboard-balance-inner-center-block">
                                            <div className="dashboard-balance-inner-center-left">
                                                <p className="name">{r.payer.name} — currently owed:</p>
                                            </div>
                                            <p className="amount">{fmtCurrency(r.owedToPayer)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {net && (
                            <div className="dashboard-balance-inner-bottom">
                                {net.amount === 0 ? (
                                    <p>-</p>
                                ) : (
                                    <>
                                        <p>{net.from?.name ?? 'User'}:</p>
                                        <p className="dashboard-balance-inner-bottom-red">
                                            -{fmtCurrency(net.amount)}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}