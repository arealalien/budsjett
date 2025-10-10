import React from 'react';
import { useAuth } from "./components/AuthContext";

export default function Budget() {
    const { user, loading } = useAuth();
    return (
        <main className="dashboard">
            {!loading && user && (
                <>
                </>
            )}
        </main>
    );
}