import React from 'react';
import { useAuth } from "../components/AuthContext";

export default function Reports() {
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