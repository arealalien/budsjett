import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { getBudgetTheme } from '../lib/budgetTheme';
import usePalette from '../components/hooks/usePalette';

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

    const bannerPalette = usePalette(budget?.bannerUrl);
    const theme = React.useMemo(
        () => getBudgetTheme(budget, bannerPalette),
        [budget, bannerPalette]
    );

    React.useEffect(() => {
        const root = document.documentElement;
        const app = document.querySelector('.app-container');
        const styleKeys = Object.keys(theme.style);

        root.classList.toggle('is-budget-themed', theme.hasTheme);
        app?.classList.toggle('is-themed', theme.hasTheme);

        if (theme.hasTheme) {
            styleKeys.forEach((key) => {
                root.style.setProperty(key, theme.style[key]);
                app?.style.setProperty(key, theme.style[key]);
            });
        } else {
            styleKeys.forEach((key) => {
                root.style.removeProperty(key);
                app?.style.removeProperty(key);
            });
        }

        return () => {
            root.classList.remove('is-budget-themed');
            app?.classList.remove('is-themed');
            styleKeys.forEach((key) => {
                root.style.removeProperty(key);
                app?.style.removeProperty(key);
            });
        };
    }, [theme]);

    const err = error?.response?.data?.error || error?.message || '';

    if (loading) return <div className="page"><p>Loading budget...</p></div>;
    if (err) return <div className="page"><p style={{ color: 'crimson' }}>{err}</p></div>;
    if (!budget) return <div className="page"><p>Not found.</p></div>;

    return (
        <main className={`budget ${theme.hasTheme ? 'is-themed' : ''}`} style={theme.style}>
            <div className="budget-window">
                <Outlet context={{ budget, reloadBudget, theme, bannerPalette }} />
            </div>
        </main>
    );
}
