import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from "../components/AuthContext";
import Header from "../components/landing/Header";
import DocumentTitle from "../components/utils/DocumentTitle";
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export default function Home() {
    const { user, loading } = useAuth();

    const navigate = useNavigate();
    const shouldLoadBudgets = !loading && !!user && !user.needsOnboarding;

    const {
        data: budgets = [],
        isError: budgetsError,
        isSuccess: budgetsLoaded,
    } = useQuery({
        queryKey: queryKeys.budgets.list(),
        enabled: shouldLoadBudgets,
        queryFn: async () => {
            const { data } = await api.get('/budgets');
            return Array.isArray(data) ? data : [];
        },
    });

    useEffect(() => {
        if (loading) return;

        if (!user) return;

        if (user.needsOnboarding) {
            navigate('/onboarding', { replace: true });
        }
    }, [loading, user, navigate]);

    useEffect(() => {
        if (!shouldLoadBudgets) return;

        if (budgetsLoaded) {
            if (budgets.length > 0) {
                navigate(`/${budgets[0].slug}`, { replace: true });
            } else {
                navigate('/budgets', { replace: true });
            }
            return;
        }

        if (budgetsError) {
            navigate('/budgets', { replace: true });
        }
    }, [budgets, budgetsError, budgetsLoaded, navigate, shouldLoadBudgets]);

    if (user?.needsOnboarding) return <Navigate to="/onboarding" replace />;

    if (loading) {
        return null;
    }

    return (
        <>
            {!loading && user && (
                <>
                    <DocumentTitle title="Astrae | Dashboard" />
                    <main className="dashboard">

                    </main>
                </>
            )}
            {!loading && !user && (
                <>
                    <DocumentTitle title="Astrae | Your Personal Accountant"/>
                    <main className="landing">
                        <Header/>
                    </main>
                </>
            )}
        </>
    );
}
