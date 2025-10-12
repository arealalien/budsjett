import React from 'react';
import { useAuth } from "./components/AuthContext";
import CurrentBalance from "./components/CurrentBalance";
import CategoryTotals from "./components/CategoryTotals";
import PurchasesTable from "./components/PurchasesTable";
import SpendingTrend from "./components/SpendingTrend";
import Header from "./components/landing/Header";
import Pricing from "./components/landing/Pricing";

export default function Home() {
    const { user, loading } = useAuth();
    return (
        <>
            {!loading && user && (
                <main className="dashboard">
                    <CurrentBalance/>
                    <CategoryTotals/>
                    <SpendingTrend/>
                    <PurchasesTable size="compact" />
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