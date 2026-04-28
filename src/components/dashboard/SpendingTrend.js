import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { api } from '../../lib/api';
import { SquircleFrame } from '../utils/SquircleFrame';

Highcharts.setOptions({
    chart: {
        animation: {
            duration: 1200,
            easing: 'easeOutQuart',
        },
        style: {
            fontFamily: 'Inter, system-ui, sans-serif',
        },
    },

    plotOptions: {
        series: {
            animation: {
                duration: 1400,
                easing: 'easeOutQuart',
            },
            lineWidth: 2,
            states: {
                hover: {
                    enabled: true,
                    lineWidth: 3,
                    halo: {
                        size: 14,
                        opacity: 0.2,
                    },
                },
            },
            marker: {
                enabled: false,
                states: {
                    hover: {
                        enabled: true,
                        radius: 5,
                    },
                },
            },
        },

        areaspline: {
            lineWidth: 3,
            marker: { enabled: false },
        },
    },

    tooltip: {
        borderRadius: 6,
    },
});

const numberFmt = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
});

export default function SpendingTrend({ size }) {
    const { slug } = useParams();

    const compact = size === 'compact';
    const defaultPeriod = compact ? 'month' : 'all';

    const [data, setData] = useState(null);
    const [period, setPeriod] = useState(defaultPeriod);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setPeriod(defaultPeriod);
    }, [defaultPeriod]);

    useEffect(() => {
        let ignore = false;

        (async () => {
            try {
                setLoading(true);
                setError('');

                const { data } = await api.get(
                    `/budgets/${encodeURIComponent(slug)}/reports/spending-trend?period=${period}`,
                    { withCredentials: true }
                );

                if (!ignore) {
                    setData(data);
                }
            } catch (e) {
                if (!ignore) {
                    setError(e.response?.data?.error || e.message || 'Failed to load spending trend');
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [slug, period]);

    const C = {
        views: '121, 159, 236',
        grid: 'rgba(255,255,255,0.08)',
        text: 'rgba(255,255,255,0.78)',
    };

    const chartHeight = compact ? 340 : 500;

    const chartOptions = useMemo(() => ({
        chart: {
            backgroundColor: 'transparent',
            type: 'area',
            height: chartHeight,
            spacingTop: compact ? 10 : undefined,
            spacingRight: compact ? 10 : undefined,
            spacingBottom: compact ? 10 : undefined,
            spacingLeft: compact ? 10 : undefined,
        },

        title: { text: null },

        credits: { enabled: false },

        xAxis: {
            type: 'datetime',
            crosshair: {
                width: 1,
                color: 'rgba(255,255,255,0.15)',
                dashStyle: 'ShortDot',
            },
        },

        yAxis: {
            title: { text: null },
        },

        tooltip: {
            shared: true,
            backgroundColor: 'rgba(10,10,18,0.95)',
            borderColor: 'rgba(255,255,255,0.08)',
            shadow: false,
            style: {
                color: '#fff',
                fontSize: '13px',
            },
            formatter: function () {
                const date = Highcharts.dateFormat('%b %e, %Y', this.x);

                let html = `<div style="font-size:12px;opacity:.6">${date}</div>`;

                this.points.forEach((p) => {
                    html += `
                        <div style="display:flex;justify-content:space-between;gap:20px">
                            <span style="color:${p.color}">${p.series.name}</span>
                            <b>${numberFmt.format(p.y)} €</b>
                        </div>
                    `;
                });

                return html;
            },
        },

        plotOptions: {
            series: {
                animation: {
                    duration: 1200,
                },
                marker: {
                    enabled: false,
                },
            },
        },

        navigator: {
            enabled: !compact,
            height: 50,
        },

        scrollbar: {
            enabled: !compact,
        },

        rangeSelector: {
            enabled: !compact,
            selected: 5,
        },

        series: data?.series
            ? data.series.map((s) => ({
                name: s.label,
                type: 'areaspline',
                data: s.points.map((p) => [
                    new Date(p.x).getTime(),
                    p.y,
                ]),
                color: `rgb(${C.views})`,
                shadow: {
                    color: `rgba(${C.views}, .75)`,
                    offsetX: 0,
                    offsetY: 0,
                    opacity: 0.25,
                    width: 15,
                },
            }))
            : [
                {
                    name: 'Spending',
                    type: 'areaspline',
                    data: (data?.points || []).map((p) => [
                        new Date(p.x).getTime(),
                        p.y,
                    ]),
                    color: `rgb(${C.views})`,
                    shadow: {
                        color: `rgba(${C.views}, .75)`,
                        offsetX: 0,
                        offsetY: 0,
                        opacity: 0.25,
                        width: 15,
                    },
                    fillColor: {
                        linearGradient: [0, 0, 0, 300],
                        stops: [
                            [0, `rgba(${C.views},0.3)`],
                            [0.7, `rgba(${C.views},0.2)`],
                            [1, `rgba(${C.views},0.1)`],
                        ],
                    },
                },
            ],
    }), [data, compact, chartHeight, C.views]);

    return (
        <SquircleFrame
            className={`highcharts ${compact ? 'is-compact' : ''}`}
            style={{ '--color': C.views }}
            n={5}
            radius="12%"
        >
            <h3 className="hc-title">Spending Trend</h3>

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