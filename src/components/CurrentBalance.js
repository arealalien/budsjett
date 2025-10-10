import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import Loader from "./Loader";

const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

export default function CurrentBalance() {
    const [pairs, setPairs] = useState([]);
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
        let ignore = false;
        (async () => {
            try {
                setLoading(true);
                setErr('');
                const { data } = await api.get('/reports/current-balance', {
                    params,
                    withCredentials: true,
                });
                if (ignore) return;
                setPairs(data.pairs || []);
                setNet(data.netBetweenTwoUsers || null);
            } catch (e) {
                if (!ignore) setErr(e.response?.data?.error || e.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [params]);

    return (
        <div className="dashboard-balance">
            {net && (
                net.amount === 0 ? (
                    <div className="dashboard-balance-glow green"></div>
                    ) : (
                    <div className="dashboard-balance-glow red"></div>
                )
            )}
            <div className="dashboard-balance-rim"></div>
            <div className="dashboard-balance-inner">
                <div className="dashboard-balance-inner-top">
                    <h3 className="dashboard-balance-inner-top-title">Current balance</h3>
                </div>

                {loading ? (
                    <Loader/>
                ) : err ? (
                    <p style={{ color: 'crimson' }}>{err}</p>
                ) : (
                    <>
                        <div className="dashboard-balance-inner-center">
                            {pairs.length === 0 ? (
                                <p>No unsettled debts 🎉</p>
                            ) : (
                                pairs.map((p, i) => (
                                    <>
                                        <div key={i} className="dashboard-balance-inner-center-block">
                                            <div className="dashboard-balance-inner-center-left">
                                                <p className="name">{p.payer.name} total:</p>
                                            </div>
                                            <p className="amount">{fmtCurrency(p.totalPaid)}</p>
                                        </div>
                                        <div key={i} className="dashboard-balance-inner-center-block">
                                            <div className="dashboard-balance-inner-center-left">
                                                <p className="name">{p.payer.name} %:</p>
                                            </div>
                                            <p className="amount">{fmtCurrency(p.amount)}</p>
                                        </div>
                                    </>
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