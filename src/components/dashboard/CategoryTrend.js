import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { api } from "../../lib/api";
import { SquircleFrame } from "../utils/SquircleFrame";

Highcharts.setOptions({
    chart: {
        animation: {
            duration: 1200,
            easing: "easeOutQuart"
        },
        style: {
            fontFamily: "Inter, system-ui, sans-serif"
        }
    },

    plotOptions: {
        series: {
            animation: {
                duration: 1400,
                easing: "easeOutQuart"
            },
            lineWidth: 2,

            states: {
                hover: {
                    enabled: true,
                    lineWidth: 3,
                    halo: {
                        size: 14,
                        opacity: 0.2
                    }
                }
            },

            marker: {
                enabled: false,
                states: {
                    hover: {
                        enabled: true,
                        radius: 5
                    }
                }
            }
        },

        areaspline: {
            lineWidth: 3,
            marker: { enabled: false }
        }
    },

    tooltip: {
        borderRadius: 6
    }
});

const numberFmt = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1
});

const toRgbTriplet = (color) => {
    const m = String(color || '').match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `${m[1]}, ${m[2]}, ${m[3]}` : '68, 68, 68';
};

export default function CategoryTrend({ size, budget }) {
    const bannerColor = toRgbTriplet(budget?.bannerColorVibrant);
    const { slug } = useParams();

    const compact = size === 'compact';
    const defaultPeriod = compact ? 'month' : 'all';

    const [data, setData] = useState(null);
    const [period, setPeriod] = useState(defaultPeriod);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setPeriod(defaultPeriod);
    }, [defaultPeriod]);

    useEffect(() => {
        let ignore = false;

        (async () => {
            try {
                setLoading(true);
                setError('');

                const res = await api.get(
                    `/budgets/${encodeURIComponent(slug)}/category-trend?period=${period}`,
                    { withCredentials: true }
                );

                if (!ignore) {
                    setData(res.data);
                }
            } catch (e) {
                if (!ignore) {
                    console.error("Failed to load category trend:", e);
                    setError(e.response?.data?.error || e.message || 'Failed to load category trend');
                    setData(null);
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        })();

        return () => { ignore = true; };
    }, [slug, period]);

    const C = {
        category: "237, 74, 84",
    };

    const chartHeight = compact ? 340 : 500;

    const chartOptions = useMemo(() => ({
        chart: {
            backgroundColor: "transparent",
            type: "area",
            height: chartHeight,
            spacingTop: compact ? 10 : undefined,
            spacingRight: compact ? 10 : undefined,
            spacingBottom: compact ? 10 : undefined,
            spacingLeft: compact ? 10 : undefined
        },

        title: { text: null },
        credits: { enabled: false },

        xAxis: {
            type: "datetime",
            crosshair: {
                width: 1,
                color: "rgba(255,255,255,0.15)",
                dashStyle: "ShortDot"
            }
        },

        yAxis: {
            title: { text: null },
        },

        tooltip: {
            shared: true,
            useHTML: true,
            backgroundColor: "rgba(10,10,18,0.95)",
            borderColor: "rgba(255,255,255,0.08)",
            shadow: false,
            style: {
                color: "#fff",
                fontSize: "13px"
            },
            formatter: function () {
                const date = Highcharts.dateFormat("%b %e, %Y", this.x);
                const points = (this.points || []).filter((p) => p.y !== 0);

                if (!points.length) return false;

                let html = `
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <div style="font-size:12px;opacity:.6;margin-bottom:2px;">${date}</div>
                `;

                points.forEach((p) => {
                    html += `
                        <div style="display:flex;justify-content:space-between;gap:20px;">
                            <span style="color:${p.color}">${p.series.name}</span>
                            <b>${numberFmt.format(p.y)} €</b>
                        </div>
                    `;
                });

                html += `</div>`;
                return html;
            }
        },

        legend: {
            enabled: !compact,
            itemStyle: {
                color: "rgba(255,255,255,0.78)"
            },
            itemHoverStyle: {
                color: "#fff"
            }
        },

        plotOptions: {
            series: {
                animation: {
                    duration: 1200
                },
                marker: {
                    enabled: false
                }
            }
        },

        navigator: {
            enabled: !compact,
            height: 50
        },

        scrollbar: {
            enabled: !compact
        },

        rangeSelector: {
            enabled: !compact,
            selected: 5
        },

        series: data?.series
            ? data.series
                .filter((s) => s.points.some((p) => p.y !== 0))
                .map((s) => {
                    const baseColor = s.color || "rgb(150,150,150)";

                    return {
                        name: s.label,
                        type: "areaspline",
                        data: s.points.map((p) => [
                            new Date(p.x).getTime(),
                            p.y
                        ]),
                        color: baseColor,
                        fillOpacity: 0.1
                    };
                })
            : []
    }), [data, compact, chartHeight]);

    return (
        <SquircleFrame
            className={`highcharts ${compact ? 'is-compact' : ''}`}
            style={{ "--color": bannerColor }}
            n={5}
            radius="12%"
        >
            <h3 className="hc-title">Spending Trend (Categories)</h3>

            {loading ? (
                <div className="highcharts-state"></div>
            ) : error ? (
                <div className="highcharts-state is-error">{error}</div>
            ) : (
                <HighchartsReact
                    highcharts={Highcharts}
                    constructorType="stockChart"
                    options={chartOptions}
                />
            )}
        </SquircleFrame>
    );
}