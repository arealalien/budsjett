import React from 'react';
import { useAuth } from "../components/AuthContext";
import PurchasesTable from "../components/PurchasesTable";

export default function Purchases() {
    const { user, loading } = useAuth();
    return (
        <main className="dashboard">
            {!loading && user && (
                <>
                    <PurchasesTable/>
                </>
            )}
        </main>
    );
}