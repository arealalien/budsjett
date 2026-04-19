import React, { useEffect , useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
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

export default function SpendingTrend() {
    const { slug } = useParams();
    const { budget } = useOutletContext();

    const [data, setData] = useState(null);
    const [period, setPeriod] = useState("all");

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const { data } = await api.get(
                    `/budgets/${encodeURIComponent(slug)}/reports/spending-trend?period=${period}`,
                    { withCredentials: true }
                );
                if (!ignore) setData(data);
            } catch (e) {
                if (!ignore) ;
            } finally {
                if (!ignore);
            }
        })();
        return () => { ignore = true; };
    }, [slug]);

    const C = {
        views: "#799fec",
        likes: "#E64D8A",
        comments: "#A779EC",
        followers: "#E68A4D",
        posts: "#e6554d",
        grid: "rgba(255,255,255,0.08)",
        text: "rgba(255,255,255,0.78)",
    };

    const viewsChart = useMemo(() => ({
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
            backgroundColor: "rgba(10,10,18,0.95)",
            borderColor: "rgba(255,255,255,0.08)",
            shadow: false,

            style: {
                color: "#fff",
                fontSize: "13px"
            },

            formatter: function () {
                const date = Highcharts.dateFormat("%b %e, %Y", this.x);

                let html = `<div style="font-size:12px;opacity:.6">${date}</div>`;

                this.points.forEach(p => {
                    html += `
                <div style="display:flex;justify-content:space-between;gap:20px">
                    <span style="color:${p.color}">${p.series.name}</span>
                    <b>${numberFmt.format(p.y)} €</b>
                </div>
            `;
                });

                return html;
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
            ? data.series.map(s => ({
                name: s.label,
                type: "areaspline",
                data: s.points.map(p => [
                    new Date(p.x).getTime(),
                    p.y
                ])
            }))
            : [
                {
                    name: "Spending",
                    type: "areaspline",
                    data: (data?.points || []).map(p => [
                        new Date(p.x).getTime(),
                        p.y
                    ]),
                    color: C.views,
                    fillColor: {
                        linearGradient: [0, 0, 0, 300],
                        stops: [
                            [0, "rgba(121, 159, 236,0.3)"],
                            [0.7, "rgba(121, 159, 236,0.2)"],
                            [1, "rgba(121, 159, 236,0.1)"]
                        ]
                    }
                }
            ]
    }), [data, C.views]);

    return (
        <>
            <div className="highcharts" style={{"--color": C.views}}>
                <h3 className="hc-title">Spending Trend</h3>
                <HighchartsReact
                    highcharts={Highcharts}
                    constructorType="stockChart"
                    options={viewsChart}
                />
            </div>
        </>
    );
}