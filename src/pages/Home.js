import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from "../components/AuthContext";
import Header from "../components/landing/Header";
import Pricing from "../components/landing/Pricing";
import DocumentTitle from "../components/utils/DocumentTitle";
import { api } from '../lib/api';

export default function Home() {
    const { user, loading } = useAuth();

    const navigate = useNavigate();
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        if (loading) return;

        if (!user) return;

        if (user.needsOnboarding) {
            navigate('/onboarding', { replace: true });
            return;
        }

        (async () => {
            try {
                setRedirecting(true);
                const { data } = await api.get('/budgets');
                if (Array.isArray(data) && data.length > 0) {
                    navigate(`/${data[0].slug}`, { replace: true });
                } else {
                    navigate('/budgets', { replace: true });
                }
            } catch {
                navigate('/budgets', { replace: true });
            } finally {
                setRedirecting(false);
            }
        })();
    }, [loading, user, navigate]);

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
                        <Pricing/>
                    </main>
                </>
            )}
        </>
    );
}