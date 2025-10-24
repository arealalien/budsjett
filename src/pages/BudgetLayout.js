import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function BudgetLayout() {
    const { slug } = useParams();
    const [budget, setBudget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const load = async () => {
        setLoading(true);
        setErr('');
        try {
            const { data } = await api.get(`/budgets/${encodeURIComponent(slug)}`);
            setBudget(data);
        } catch (e) {
            setErr(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

    if (loading) return <div className="page"><p>Loading budget…</p></div>;
    if (err) return <div className="page"><p style={{color:'crimson'}}>{err}</p></div>;
    if (!budget) return <div className="page"><p>Not found.</p></div>;

    return (
        <main className="budget">
            <div className="budget-window">
                <Outlet context={{ budget, reloadBudget: load }} />
            </div>
        </main>
    );
}