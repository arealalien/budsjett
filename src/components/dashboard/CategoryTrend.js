import React, { useEffect , useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import {api} from "../../lib/api";

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

const numberFmt = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export default function CategoryTrend() {
    const { slug } = useParams();

    const [data, setData] = useState(null);
    const [period, setPeriod] = useState("all");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let ignore = false;

        (async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await api.get(
                    `/budgets/${encodeURIComponent(slug)}/category-trend?period=${period}`,
                    { withCredentials: true }
                );

                if (!ignore) setData(res.data);
            } catch (e) {
                if (!ignore) {
                    console.error("Failed to load category trend:", e);
                    setError(e);
                    setData(null);
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        })();

        return () => { ignore = true; };
    }, [slug, period]);

    const C = {
        grid: "rgba(255,255,255,0.08)",
        text: "rgba(255,255,255,0.78)",
    };

    const chartOptions = useMemo(() => ({
        chart: {
            backgroundColor: "transparent",
            type: "area",
            height: 500
        },

        title: { text: null },

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

                const points = this.points.filter(p => p.y !== 0);

                if (!points.length) return false;

                let html = `
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="font-size:12px;opacity:.6;margin-bottom:2px;">${date}</div>
        `;

                points.forEach(p => {
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
            enabled: true,
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
            enabled: true,
            height: 50
        },

        scrollbar: {
            enabled: false
        },

        rangeSelector: {
            selected: 5
        },

        series: data?.series
            ? data.series
                .filter(s => s.points.some(p => p.y !== 0))
                .map(s => {
                    const baseColor = s.color || "rgb(150,150,150)";

                    return {
                        name: s.label,
                        type: "areaspline",
                        data: s.points.map(p => [
                            new Date(p.x).getTime(),
                            p.y
                        ]),
                        color: baseColor,
                        fillOpacity: 0.1
                    };
                })
            : []

    }), [data]);

    return (
        <>
            <div className="highcharts" style={{"--color": '#ed4a54'}}>
                <h3 className="hc-title">Spending Trend (Categories)</h3>
                <HighchartsReact
                    highcharts={Highcharts}
                    constructorType="stockChart"
                    options={chartOptions}
                />
            </div>
        </>
    );
}