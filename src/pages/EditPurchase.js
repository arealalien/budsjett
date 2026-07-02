import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PurchaseForm from '../components/dashboard/PurchaseForm';
import Loader from '../components/Loader';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export default function EditPurchase() {
    const { slug, purchaseId } = useParams();
    const location = useLocation();
    const purchasesSearch = typeof location.state?.purchasesSearch === 'string'
        ? location.state.purchasesSearch
        : '';
    const detailTo = `/${slug}/purchases/${purchaseId}`;

    const {
        data: purchase = null,
        error,
        isLoading,
    } = useQuery({
        queryKey: queryKeys.purchases.detail(slug, purchaseId),
        enabled: !!slug && !!purchaseId,
        queryFn: async () => {
            const { data } = await api.get(
                `/purchases/${encodeURIComponent(slug)}/purchases/${encodeURIComponent(purchaseId)}`,
                { withCredentials: true }
            );
            return data;
        },
    });

    if (isLoading) {
        return <Loader />;
    }

    if (error) {
        const message = error?.response?.data?.error || error.message || 'Failed to load purchase';
        return <div className="purchase-details-state is-error">{message}</div>;
    }

    if (!purchase) {
        return <div className="purchase-details-state">Purchase not found.</div>;
    }

    return (
        <div className="purchase">
            <Link
                to={detailTo}
                state={{ purchasesSearch }}
                className="purchase-details-back purchase-edit-back"
            >
                ← Back to purchase
            </Link>

            <PurchaseForm
                mode="edit"
                purchase={purchase}
                purchasesSearch={purchasesSearch}
            />
        </div>
    );
}
