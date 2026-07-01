import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/useUiStore";

const numberFmt = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1
});

const toRgbTriplet = (color) => {
    const m = String(color || '').match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `${m[1]}, ${m[2]}, ${m[3]}` : '68, 68, 68';
};

export default function CategoryTotals({ size, budget }) {
    const bannerColor = toRgbTriplet(budget?.bannerColorVibrant);
    const { slug } = useParams();

    const compact = size === 'compact';
    const defaultPeriod = 'month';
    const chartPeriodKey = compact ? 'categoryTotals:compact' : 'categoryTotals';

    const period = useUiStore((state) => state.chartPeriods[chartPeriodKey] || defaultPeriod);
    const setChartPeriod = useUiStore((state) => state.setChartPeriod);

    const {
        data = null,
        error,
        isLoading: loading,
    } = useQuery({
        queryKey: queryKeys.reports.categoryTotals(slug, period),
        enabled: !!slug,
        queryFn: async () => {
            const { data } = await api.get(
                `/reports/${encodeURIComponent(slug)}/category-totals`,
                { params: { period }, withCredentials: true }
            );
            return data;
        },
    });

    const errorMessage = error?.response?.data?.error || error?.message || 'Failed to load category totals';

    const chartHeight = compact ? 320 : 400;

    const seriesData = useMemo(() => {
        const items = data?.items || [];

        const visibleItems = compact
            ? items.filter((cat) => Number(cat.total) > 0).slice(0, 5)
            : items;

        return visibleItems.map((cat) => ({
            name: cat.name,
            y: cat.total,
            color: `rgb(${cat.color})`,
        }));
    }, [data, compact]);

    const chartOptions = useMemo(() => ({
        chart: {
            type: "column",
            backgroundColor: "transparent",
            height: chartHeight,
            spacingTop: compact ? 10 : undefined,
            spacingRight: compact ? 10 : undefined,
            spacingBottom: compact ? 10 : undefined,
            spacingLeft: compact ? 10 : undefined
        },

        title: { text: null },
        credits: { enabled: false },

        xAxis: {
            type: "category",
            labels: {
                style: { color: "#ccc" }
            }
        },

        yAxis: {
            title: { text: null }
        },

        legend: {
            enabled: false
        },

        tooltip: {
            backgroundColor: "rgba(10,10,18,0.95)",
            borderColor: "rgba(255,255,255,0.08)",
            style: { color: "#fff" },
            formatter: function () {
                return `
                    <b>${this.point.name}</b><br/>
                    ${numberFmt.format(this.y)} €
                `;
            }
        },

        plotOptions: {
            column: {
                borderRadius: 6
            }
        },

        series: [{
            colorByPoint: true,
            data: seriesData
        }]
    }), [chartHeight, compact, seriesData]);

    const labels = {
        week: "Week",
        month: "This Month",
        lastMonth: "Last Month",
        all: "All Time"
    };

    return (
        <div
            className={`highcharts ${compact ? 'is-compact' : ''}`}
            style={{ "--color": bannerColor }}
        >
            {!compact && <h3 className="hc-title">Category Totals</h3>}

            {!compact && (
                <div style={{ display: "flex", gap: "0.5em", marginBottom: "1em" }}>
                    {["week", "month", "lastMonth", "all"].map((p) => (
                        <button
                            key={p}
                            onClick={() => setChartPeriod(chartPeriodKey, p)}
                            style={{
                                padding: "0.4em 0.8em",
                                background: period === p ? "#fff" : "transparent",
                                color: period === p ? "#000" : "#fff",
                                border: "1px solid rgba(255,255,255,0.2)",
                                borderRadius: "6px",
                                cursor: "pointer"
                            }}
                        >
                            {labels[p]}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="highcharts-state"></div>
            ) : error ? (
                <div className="highcharts-state is-error">{errorMessage}</div>
            ) : (
                <HighchartsReact
                    highcharts={Highcharts}
                    options={chartOptions}
                />
            )}
        </div>
    );
}
