import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export default function BudgetLayout() {
    const { slug } = useParams();

    const {
        data: budget = null,
        error,
        isLoading: loading,
        refetch: reloadBudget,
    } = useQuery({
        queryKey: queryKeys.budgets.detail(slug),
        enabled: !!slug,
        queryFn: async () => {
            const { data } = await api.get(`/budgets/${encodeURIComponent(slug)}`);
            return data;
        },
    });

    const err = error?.response?.data?.error || error?.message || '';

    if (loading) return <div className="page"><p>Loading budget...</p></div>;
    if (err) return <div className="page"><p style={{ color: 'crimson' }}>{err}</p></div>;
    if (!budget) return <div className="page"><p>Not found.</p></div>;

    return (
        <main className="budget">
            <div className="budget-window">
                <Outlet context={{ budget, reloadBudget }} />
            </div>
        </main>
    );
}
