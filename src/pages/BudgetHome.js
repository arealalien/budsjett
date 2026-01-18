import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PurchasesTable from "../components/dashboard/PurchasesTable";
import SpendingTrend from "../components/dashboard/SpendingTrend";
import CurrentBalance from "../components/dashboard/CurrentBalance";
import CategoryTotals from "../components/dashboard/CategoryTotals";
import IncomeTotals from "../components/dashboard/IncomeTotals";

const toRgbTriplet = (color) => {
    const m = String(color).match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `${m[1]} ${m[2]} ${m[3]}` : color; // if already CSS color, leave as-is
};

export default function BudgetHome() {
    const { budget } = useOutletContext();

    // Publish variables like --cat-groceries: "34 197 94"
    const catCssVars = (budget?.categories || []).reduce((vars, c) => {
        if (c?.slug && c?.color) {
            vars[`--cat-${c.slug}`] = toRgbTriplet(c.color);
        }
        return vars;
    }, {});

    return (
        <div className="budget-home" style={{ ...catCssVars, width: '100%' }}>
            <div>
                <PurchasesTable size="compact" />
                <SpendingTrend />
                <CurrentBalance />
                <CategoryTotals />
                <IncomeTotals />
            </div>
        </div>
    );
}