import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import BudgetBanner from "../components/dashboard/BudgetBanner";
import SpendingTrend from "../components/dashboard/SpendingTrend";
import CategoryTrend from "../components/dashboard/CategoryTrend";
import CurrentBalance from "../components/dashboard/CurrentBalance";
import CategoryTotals from "../components/dashboard/CategoryTotals";

const toRgbTriplet = (color) => {
    const m = String(color).match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `${m[1]} ${m[2]} ${m[3]}` : color;
};

const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString(undefined, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function buildBannerSummary(data) {
    const members = data?.members ?? [];
    const settlements = data?.settlements ?? [];
    const net = data?.netBetweenTwoUsers ?? null;

    const totalSettlementAmount = settlements.reduce(
        (sum, s) => sum + Number(s.amount || 0),
        0
    );

    if (!members.length) {
        return {
            subtitle: 'No balance data yet',
            title: '—',
        };
    }

    if (net && members.length === 2) {
        if (Number(net.amount) === 0) {
            return {
                subtitle: 'Everyone is settled',
                title: fmtCurrency(0),
            };
        }

        return {
            subtitle: `${net.from?.name ?? 'User'} owes ${net.to?.name ?? 'User'}`,
            title: fmtCurrency(net.amount),
        };
    }

    if (!settlements.length) {
        return {
            subtitle: 'Everyone is settled',
            title: fmtCurrency(0),
        };
    }

    if (settlements.length === 1) {
        const s = settlements[0];

        return {
            subtitle: `${s.from?.name ?? 'User'} pays ${s.to?.name ?? 'User'}`,
            title: fmtCurrency(s.amount),
        };
    }

    return {
        subtitle: `${settlements.length} transfers to settle up`,
        title: fmtCurrency(totalSettlementAmount),
    };
}

export default function BudgetHome() {
    const { budget } = useOutletContext();

    const [balanceData, setBalanceData] = useState(null);

    useEffect(() => {
        if (!budget?.slug) return;
        let ignore = false;

        (async () => {
            try {
                const { data } = await api.get(
                    `/reports/${encodeURIComponent(budget.slug)}/reports/current-balance`,
                    { withCredentials: true }
                );

                if (!ignore) {
                    setBalanceData(data);
                }
            } catch (err) {
                if (!ignore) {
                    setBalanceData(null);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [budget?.slug]);

    const balanceSummary = useMemo(
        () => buildBannerSummary(balanceData),
        [balanceData]
    );

    const catCssVars = (budget?.categories || []).reduce((vars, c) => {
        if (c?.slug && c?.color) {
            vars[`--cat-${c.slug}`] = toRgbTriplet(c.color);
        }
        return vars;
    }, {});

    return (
        <div className="budget-home" style={{ ...catCssVars, width: '100%' }}>
            <BudgetBanner budget={budget} balanceSummary={balanceSummary} />
            <CurrentBalance />
            <SpendingTrend budget={budget} />
            <CategoryTrend budget={budget} />
            <CategoryTotals budget={budget} />
        </div>
    );
}