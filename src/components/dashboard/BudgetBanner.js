import React from 'react';
import { SquircleFrame } from '../utils/SquircleFrame';

const toRgbTriplet = (color) => {
    const m = String(color || '').match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `${m[1]}, ${m[2]}, ${m[3]}` : '68, 68, 68';
};

export default function BudgetBanner({ budget, balanceSummary }) {
    const bannerColor = toRgbTriplet(budget?.bannerColor);
    const hasBanner = Boolean(budget?.bannerUrl);

    return (
        <>
            <SquircleFrame
                className="budget-banner"
                innerClassName="budget-banner-inner"
                style={{ '--color': bannerColor }}
                n={5}
                radius="12%"
            >
                <div className="budget-banner-top">
                    <h2 className="budget-banner-top-title">
                        {budget?.name || 'Untitled budget'}
                    </h2>
                </div>

                <div className="budget-banner-bottom">
                    <h2 className="budget-banner-bottom-subtitle">
                        {balanceSummary?.subtitle || 'No balance data yet'}
                    </h2>

                    <h2 className="budget-banner-bottom-title">
                        {balanceSummary?.title || '—'}
                    </h2>
                </div>

                <div className="budget-banner-overlay" />

                {hasBanner ? (
                    <img
                        src={budget.bannerUrl}
                        alt={`${budget?.name || 'Budget'} banner`}
                        className="budget-banner-image"
                    />
                ) : (
                    <div className="budget-banner-fallback" />
                )}
            </SquircleFrame>
        </>
    );
}