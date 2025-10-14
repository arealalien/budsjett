import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from "../components/AuthContext";
import Header from "../components/landing/Header";
import Pricing from "../components/landing/Pricing";

export default function Home() {
    const { user, loading } = useAuth();
    if (user?.needsOnboarding) return <Navigate to="/onboarding" replace />;

    return (
        <>
            {!loading && user && (
                <main className="dashboard">

                </main>
            )}
            {!loading && !user && (
                <main className="landing">
                    <Header/>
                    <Pricing/>
                </main>
            )}
        </>
    );
}