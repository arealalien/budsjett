import React from 'react';
import { useAuth } from "../components/AuthContext";

export default function BudgetSettings() {
    const { user, loading } = useAuth();
    return (
        <div className="dashboard">
            {!loading && user && (
                <>

                </>
            )}
        </div>
    );
}