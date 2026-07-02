import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AnalyticsOverview from '../components/dashboard/AnalyticsOverview';

const toRgbTriplet = (color) => {
    const m = String(color).match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `${m[1]} ${m[2]} ${m[3]}` : color;
};

export default function Statistics() {
    const { budget, theme, bannerPalette } = useOutletContext();

    // Publish variables like --cat-groceries: "34 197 94"
    const catCssVars = (budget?.categories || []).reduce((vars, c) => {
        if (c?.slug && c?.color) {
            vars[`--cat-${c.slug}`] = toRgbTriplet(c.color);
        }
        return vars;
    }, {});

    return (
        <div className="statistics" style={{ ...catCssVars, width: '100%' }}>
            <AnalyticsOverview
                budget={budget}
                view="statistics"
                theme={theme}
                palette={bannerPalette}
            />
        </div>
    );
}
