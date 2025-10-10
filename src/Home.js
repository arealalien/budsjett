import React from 'react';
import { useAuth } from "./components/AuthContext";
import CurrentBalance from "./components/CurrentBalance";
import CategoryTotals from "./components/CategoryTotals";
import PurchasesTable from "./components/PurchasesTable";
import SpendingTrend from "./components/SpendingTrend";

export default function Home() {
    const { user, loading } = useAuth();
    return (
        <main className="dashboard">
            {!loading && user && (
                <>
                    <CurrentBalance/>
                    <CategoryTotals/>
                    <SpendingTrend/>
                    <PurchasesTable size="compact" />
                </>
            )}
        </main>
    );
}