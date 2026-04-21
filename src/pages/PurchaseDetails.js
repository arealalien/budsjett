import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { format } from 'date-fns';
import nb from 'date-fns/locale/nb';
import Loader from '../components/Loader';
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import Avatar from '../components/Avatar';

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

const fmtCurrency = (n) =>
    (Number.isFinite(n) ? n : Number(n))
        .toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const fmtDateTime = (value) => {
    try {
        return format(new Date(value), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb });
    } catch {
        return '—';
    }
};

const fmtDateOnly = (value) => {
    try {
        return format(new Date(value), "d. MMMM yyyy", { locale: nb });
    } catch {
        return '—';
    }
};

const avatarVersionOf = (u) => u?.avatarUpdatedAt || u?.avatarStorageKey || undefined;
const nameOf = (u) => u?.name || u?.displayName || u?.username || '—';

const CHART_COLORS = {
    area: "#799fec",
    point: "#E64D8A",
    grid: "rgba(255,255,255,0.08)",
    text: "rgba(255,255,255,0.78)",
    plotLine: "rgba(255,255,255,0.2)"
};

export default function PurchaseDetails() {
    const { slug, purchaseId } = useParams();
    const { budget } = useOutletContext() ?? {};

    const [purchase, setPurchase] = useState(null);
    const [trendData, setTrendData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let ignore = false;

        (async () => {
            try {
                setLoading(true);
                setErr('');

                const [purchaseRes, trendRes] = await Promise.allSettled([
                    api.get(
                        `/purchases/${encodeURIComponent(slug)}/purchases/${encodeURIComponent(purchaseId)}`,
                        { withCredentials: true }
                    ),
                    api.get(
                        `/purchases/${encodeURIComponent(slug)}/reports/spending-trend?period=all`,
                        { withCredentials: true }
                    )
                ]);

                if (ignore) return;

                if (purchaseRes.status === 'fulfilled') {
                    setPurchase(purchaseRes.value.data);
                } else {
                    throw purchaseRes.reason;
                }

                if (trendRes.status === 'fulfilled') {
                    setTrendData(trendRes.value.data);
                } else {
                    setTrendData(null);
                }
            } catch (e) {
                if (!ignore) {
                    setErr(e.response?.data?.error || e.message || 'Failed to load purchase');
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
    }, [slug, purchaseId]);

    const shareRows = useMemo(() => {
        if (!purchase?.shares?.length) return [];
        const baseAmount = Math.abs(Number(purchase.amount) || 0);

        return purchase.shares.map((s) => {
            const amount = s.fixedAmount != null
                ? Number(s.fixedAmount)
                : Math.round(baseAmount * (Number(s.percent) || 0)) / 100;

            return {
                ...s,
                computedAmount: amount,
            };
        });
    }, [purchase]);

    const chartOptions = useMemo(() => {
        if (!purchase) return null;

        const purchaseTs = new Date(purchase.paidAt).getTime();
        const purchaseAmount = Math.abs(Number(purchase.amount) || 0);

        let areaPoints = [];

        if (trendData?.series?.length) {
            areaPoints = trendData.series[0].points.map((p) => [
                new Date(p.x).getTime(),
                p.y
            ]);
        } else if (trendData?.points?.length) {
            areaPoints = trendData.points.map((p) => [
                new Date(p.x).getTime(),
                p.y
            ]);
        }

        if (!areaPoints.length) {
            const pad = 1000 * 60 * 60 * 24 * 7;
            areaPoints = [
                [purchaseTs - pad, 0],
                [purchaseTs, purchaseAmount],
                [purchaseTs + pad, 0],
            ];
        }

        const firstTs = areaPoints[0]?.[0] ?? purchaseTs;
        const lastTs = areaPoints[areaPoints.length - 1]?.[0] ?? purchaseTs;
        const defaultWindow = 1000 * 60 * 60 * 24 * 30;

        const min = Math.max(firstTs, purchaseTs - defaultWindow);
        const max = Math.min(lastTs, purchaseTs + defaultWindow);

        return {
            chart: {
                backgroundColor: "transparent",
                type: "area",
                height: 360
            },

            title: { text: null },
            credits: { enabled: false },

            xAxis: {
                type: "datetime",
                min,
                max,
                crosshair: {
                    width: 1,
                    color: "rgba(255,255,255,0.15)",
                    dashStyle: "ShortDot"
                },
                plotLines: [
                    {
                        value: purchaseTs,
                        color: CHART_COLORS.plotLine,
                        width: 1,
                        dashStyle: "ShortDash",
                        zIndex: 4,
                        label: {
                            text: "Purchase",
                            rotation: 0,
                            y: 16,
                            style: {
                                color: "rgba(255,255,255,0.6)",
                                fontSize: "11px"
                            }
                        }
                    }
                ]
            },

            yAxis: {
                title: { text: null },
                gridLineColor: CHART_COLORS.grid,
                labels: {
                    style: {
                        color: CHART_COLORS.text
                    },
                    formatter: function () {
                        return fmtCurrency(this.value);
                    }
                }
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
                    const points = this.points || [];

                    let html = `
                        <div style="display:flex;flex-direction:column;gap:6px;">
                            <div style="font-size:12px;opacity:.6;margin-bottom:2px;">${date}</div>
                    `;

                    points.forEach((p) => {
                        html += `
                            <div style="display:flex;justify-content:space-between;gap:20px;">
                                <span style="color:${p.color}">${p.series.name}</span>
                                <b>${fmtCurrency(p.y)}</b>
                            </div>
                        `;
                    });

                    html += `</div>`;
                    return html;
                }
            },

            legend: { enabled: false },

            navigator: {
                enabled: false
            },

            scrollbar: {
                enabled: false
            },

            rangeSelector: {
                enabled: false
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

            series: [
                {
                    name: "Budget spending",
                    type: "areaspline",
                    data: areaPoints,
                    color: CHART_COLORS.area,
                    fillColor: {
                        linearGradient: [0, 0, 0, 300],
                        stops: [
                            [0, "rgba(121, 159, 236,0.3)"],
                            [0.7, "rgba(121, 159, 236,0.18)"],
                            [1, "rgba(121, 159, 236,0.06)"]
                        ]
                    },
                    zIndex: 1
                },
                {
                    name: "This purchase",
                    type: "scatter",
                    data: [[purchaseTs, purchaseAmount]],
                    color: CHART_COLORS.point,
                    marker: {
                        enabled: true,
                        radius: 6,
                        lineWidth: 2,
                        lineColor: "#fff",
                        fillColor: CHART_COLORS.point,
                        symbol: "circle"
                    },
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            return "Purchase";
                        },
                        style: {
                            color: "#fff",
                            textOutline: "none",
                            fontSize: "11px",
                            fontWeight: 600
                        },
                        y: -12
                    },
                    zIndex: 5
                }
            ]
        };
    }, [purchase, trendData]);

    if (loading) {
        return <Loader />;
    }

    if (err) {
        return <div className="purchase-details-state is-error">{err}</div>;
    }

    if (!purchase) {
        return <div className="purchase-details-state">Purchase not found.</div>;
    }

    return (
        <div className="purchase-details">
            <div className="purchase-details-top">
                <Link to={`/${slug}/purchases`} className="purchase-details-back">
                    ← Back to purchases
                </Link>

                <div className="purchase-details-hero">
                    <div className="purchase-details-hero-rim" />
                    <div className="purchase-details-hero-glow" />

                    <div className="purchase-details-hero-inner">
                        <div className="purchase-details-heading">
                            <div>
                                <p className="purchase-details-eyebrow">
                                    {budget?.name || 'Budget'} · Purchase
                                </p>

                                <h1>{purchase.itemName}</h1>

                                <div className="purchase-details-pills">
                                    <span className="purchase-details-pill">
                                        {purchase.category?.name || 'No category'}
                                    </span>

                                    <span className={`purchase-details-pill ${purchase.shared ? 'is-shared' : 'is-personal'}`}>
                                        {purchase.shared ? 'Shared' : 'Personal'}
                                    </span>

                                    {purchase.notes && (
                                        <span className="purchase-details-pill has-note">
                                            Note added
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="purchase-details-amount">
                                <span>Total</span>
                                <strong>{fmtCurrency(Number(purchase.amount))}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="purchase-details-grid">
                <section className="purchase-details-card purchase-details-card-chart">
                    <div className="purchase-details-card-head">
                        <div>
                            <h3>Purchase in timeline</h3>
                            <p>See where this purchase happened in your spending history.</p>
                        </div>
                    </div>

                    <div className="purchase-details-chart">
                        {chartOptions && (
                            <HighchartsReact
                                highcharts={Highcharts}
                                constructorType="stockChart"
                                options={chartOptions}
                            />
                        )}
                    </div>
                </section>

                <section className="purchase-details-card">
                    <div className="purchase-details-card-head">
                        <div>
                            <h3>Overview</h3>
                            <p>Main information about this purchase.</p>
                        </div>
                    </div>

                    <div className="purchase-details-list">
                        <div className="purchase-details-list-row">
                            <span>Category</span>
                            <strong>{purchase.category?.name || '—'}</strong>
                        </div>

                        <div className="purchase-details-list-row">
                            <span>Paid by</span>

                            <div className="purchase-details-person">
                                <Avatar
                                    user={purchase.paidBy}
                                    size="2.4rem"
                                    n={3.25}
                                    version={avatarVersionOf(purchase.paidBy)}
                                    alt={nameOf(purchase.paidBy)}
                                    fallbackSrc="/images/avatar-placeholder.jpg"
                                />

                                <strong>{nameOf(purchase.paidBy)}</strong>
                            </div>
                        </div>

                        <div className="purchase-details-list-row">
                            <span>Date and time</span>
                            <strong>{fmtDateTime(purchase.paidAt)}</strong>
                        </div>

                        <div className="purchase-details-list-row">
                            <span>Shared</span>
                            <strong>{purchase.shared ? 'Yes' : 'No'}</strong>
                        </div>

                        <div className="purchase-details-list-row">
                            <span>Created by</span>

                            <div className="purchase-details-person">
                                <Avatar
                                    user={purchase.createdBy}
                                    size="2.4rem"
                                    n={3.25}
                                    version={avatarVersionOf(purchase.createdBy)}
                                    alt={nameOf(purchase.createdBy)}
                                    fallbackSrc="/images/avatar-placeholder.jpg"
                                />

                                <strong>{nameOf(purchase.createdBy)}</strong>
                            </div>
                        </div>

                        <div className="purchase-details-list-row">
                            <span>Created</span>
                            <strong>{fmtDateTime(purchase.createdAt)}</strong>
                        </div>

                        <div className="purchase-details-list-row">
                            <span>Last updated</span>
                            <strong>{fmtDateTime(purchase.updatedAt)}</strong>
                        </div>
                    </div>
                </section>

                <section className="purchase-details-card">
                    <div className="purchase-details-card-head">
                        <div>
                            <h3>Notes</h3>
                            <p>Extra context for this purchase.</p>
                        </div>
                    </div>

                    {purchase.notes ? (
                        <div className="purchase-details-note">
                            {purchase.notes}
                        </div>
                    ) : (
                        <div className="purchase-details-empty">
                            No note added for this purchase.
                        </div>
                    )}
                </section>

                <section className="purchase-details-card purchase-details-card-wide">
                    <div className="purchase-details-card-head">
                        <div>
                            <h3>Split details</h3>
                            <p>How this purchase is divided across members.</p>
                        </div>
                    </div>

                    {!shareRows.length ? (
                        <div className="purchase-details-empty">No split data available.</div>
                    ) : (
                        <div className="purchase-details-share-list">
                            {shareRows.map((s) => (
                                <div key={`${purchase.id}-${s.userId}`} className="purchase-details-share-row">
                                    <div className="purchase-details-share-user">
                                        <div className="purchase-details-share-user-top">
                                            <Avatar
                                                user={s.user}
                                                size="2.6rem"
                                                n={3.25}
                                                version={avatarVersionOf(s.user)}
                                                alt={nameOf(s.user)}
                                                fallbackSrc="/images/avatar-placeholder.jpg"
                                            />

                                            <strong>{nameOf(s.user)}</strong>
                                        </div>

                                        <div className="purchase-details-share-meta">
                                            {s.fixedAmount != null ? 'Fixed amount' : `${s.percent}% share`}
                                        </div>
                                    </div>

                                    <div className="purchase-details-share-values">
                                        <strong>{fmtCurrency(s.computedAmount)}</strong>

                                        <span className={`purchase-details-share-status ${s.isSettled ? 'is-settled' : 'is-open'}`}>
                                            {s.isSettled
                                                ? `Settled${s.settledAt ? ` · ${fmtDateOnly(s.settledAt)}` : ''}`
                                                : 'Open'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}