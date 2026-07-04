import React, { useEffect, useMemo } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import nb from 'date-fns/locale/nb';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import tinycolor from 'tinycolor2';
import Avatar from '../components/Avatar';
import Loader from '../components/Loader';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { toCssColor } from '../lib/budgetTheme';

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
                        size: 0,
                        opacity: 0,
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

const DEFAULT_CATEGORY_TRIPLET = '121, 159, 236';
const DEFAULT_CATEGORY_COLOR = `rgb(${DEFAULT_CATEGORY_TRIPLET})`;
const PURCHASE_THEME_KEYS = [
    '--app-theme-accent',
    '--app-theme-accent-strong',
    '--app-theme-accent-muted',
    '--app-theme-accent-dark',
    '--app-theme-accent-dark-muted',
    '--app-theme-accent-light',
    '--app-theme-accent-text',
    '--app-theme-soft',
    '--app-theme-softer',
    '--app-theme-border',
    '--app-theme-border-strong',
    '--app-theme-glow',
    '--app-theme-focus',
    '--budget-theme-accent',
    '--budget-theme-accent-rgb',
    '--budget-theme-accent-strong',
    '--budget-theme-accent-muted',
    '--budget-theme-accent-dark',
    '--budget-theme-accent-dark-muted',
    '--budget-theme-accent-light',
    '--color',
];

function colorForCategory(value) {
    const color = tinycolor(toCssColor(value, DEFAULT_CATEGORY_COLOR));
    return color.isValid() ? color : tinycolor(DEFAULT_CATEGORY_COLOR);
}

function tripletForColor(color) {
    const { r, g, b } = color.toRgb();
    return `${r}, ${g}, ${b}`;
}

function buildCategoryTheme(value) {
    const base = colorForCategory(value);
    const accent = base.toHexString();
    const isLight = base.isLight();
    const accentStrong = base.clone().saturate(10).lighten(isLight ? 4 : 16).toHexString();
    const accentMuted = base.clone().desaturate(18).lighten(isLight ? 0 : 7).toHexString();
    const accentDark = base.clone().saturate(8).darken(isLight ? 34 : 16).toHexString();
    const accentDarkMuted = base.clone().desaturate(22).darken(isLight ? 28 : 12).toHexString();
    const accentLight = base.clone().desaturate(4).lighten(isLight ? 12 : 32).toHexString();
    const accentText = tinycolor.mostReadable(accent, ['#0b0f19', '#ffffff'], {
        includeFallbackColors: true,
    }).toHexString();
    const triplet = tripletForColor(base);
    const appStyle = {
        '--app-theme-accent': accent,
        '--app-theme-accent-strong': accentStrong,
        '--app-theme-accent-muted': accentMuted,
        '--app-theme-accent-dark': accentDark,
        '--app-theme-accent-dark-muted': accentDarkMuted,
        '--app-theme-accent-light': accentLight,
        '--app-theme-accent-text': accentText,
        '--app-theme-soft': `color-mix(in srgb, ${accent} 16%, transparent)`,
        '--app-theme-softer': `color-mix(in srgb, ${accent} 8%, transparent)`,
        '--app-theme-border': `color-mix(in srgb, ${accent} 42%, transparent)`,
        '--app-theme-border-strong': `color-mix(in srgb, ${accent} 68%, transparent)`,
        '--app-theme-glow': 'transparent',
        '--app-theme-focus': `2px color-mix(in srgb, ${accent} 30%, transparent)`,
        '--budget-theme-accent': accent,
        '--budget-theme-accent-rgb': triplet,
        '--budget-theme-accent-strong': accentStrong,
        '--budget-theme-accent-muted': accentMuted,
        '--budget-theme-accent-dark': accentDark,
        '--budget-theme-accent-dark-muted': accentDarkMuted,
        '--budget-theme-accent-light': accentLight,
        '--color': triplet,
    };

    return {
        accent,
        accentStrong,
        accentMuted,
        accentDark,
        accentDarkMuted,
        accentLight,
        triplet,
        rgba: (alpha) => `rgba(${triplet}, ${alpha})`,
        appStyle,
        pageStyle: {
            '--color': triplet,
            '--purchase-accent': accent,
            '--purchase-accent-rgb': triplet,
            '--purchase-accent-strong': accentStrong,
            '--purchase-accent-muted': accentMuted,
            '--purchase-accent-dark': accentDark,
            '--purchase-accent-dark-muted': accentDarkMuted,
            '--purchase-accent-light': accentLight,
        },
    };
}

const fmtCurrency = (value) => {
    const number = Number(value);
    return Number.isFinite(number)
        ? number.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })
        : '-';
};

const fmtDateTime = (value) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '-';

    try {
        return format(date, "d. MMMM yyyy 'kl.' HH:mm", { locale: nb });
    } catch {
        return '-';
    }
};

const fmtDateOnly = (value) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '-';

    try {
        return format(date, 'd. MMMM yyyy', { locale: nb });
    } catch {
        return '-';
    }
};

const avatarVersionOf = (user) => user?.avatarUpdatedAt || user?.avatarStorageKey || undefined;
const nameOf = (user) => user?.name || user?.displayName || user?.username || '-';

export default function PurchaseDetails() {
    const { slug, purchaseId } = useParams();
    const location = useLocation();
    const outletContext = useOutletContext();
    const budgetTheme = outletContext?.theme;

    const {
        data: purchase = null,
        error: purchaseError,
        isLoading: loading,
    } = useQuery({
        queryKey: queryKeys.purchases.detail(slug, purchaseId),
        enabled: !!slug && !!purchaseId,
        queryFn: async () => {
            const { data } = await api.get(
                `/purchases/${encodeURIComponent(slug)}/purchases/${encodeURIComponent(purchaseId)}`,
                { withCredentials: true }
            );
            return data;
        },
    });

    const { data: trendData = null } = useQuery({
        queryKey: queryKeys.purchases.timeline(slug),
        enabled: !!slug,
        queryFn: async () => {
            const { data } = await api.get(
                `/purchases/${encodeURIComponent(slug)}/reports/spending-trend`,
                { params: { period: 'all' }, withCredentials: true }
            );
            return data;
        },
    });

    const err = purchaseError?.response?.data?.error || purchaseError?.message || '';
    const purchasesSearch = typeof location.state?.purchasesSearch === 'string'
        ? location.state.purchasesSearch
        : '';
    const purchasesBackTo = `/${slug}/purchases${purchasesSearch ? `?${purchasesSearch}` : ''}`;

    const purchaseCategories = useMemo(() => {
        const source = Array.isArray(purchase?.categories) && purchase.categories.length
            ? purchase.categories
            : [purchase?.category].filter(Boolean);
        const seen = new Set();

        return source.filter((category) => {
            if (!category?.id || seen.has(category.id)) return false;
            seen.add(category.id);
            return true;
        });
    }, [purchase]);

    const primaryCategory = purchaseCategories[0] || purchase?.category || null;
    const primaryCategoryColor = primaryCategory?.color || DEFAULT_CATEGORY_COLOR;
    const categoryLabel = purchaseCategories.length
        ? purchaseCategories.map((category) => category.name).filter(Boolean).join(', ')
        : 'No category';
    const categoryTheme = useMemo(
        () => buildCategoryTheme(primaryCategoryColor),
        [primaryCategoryColor]
    );

    const shareRows = useMemo(() => {
        if (!purchase?.shares?.length) return [];
        const baseAmount = Math.abs(Number(purchase.amount) || 0);

        return purchase.shares.map((share) => {
            const amount = share.fixedAmount != null
                ? Number(share.fixedAmount)
                : Math.round(baseAmount * (Number(share.percent) || 0)) / 100;

            return {
                ...share,
                computedAmount: amount,
            };
        });
    }, [purchase]);

    const purchaseAmount = Number(purchase?.amount) || 0;
    const absolutePurchaseAmount = Math.abs(purchaseAmount);
    const splitSummary = shareRows.length
        ? `${shareRows.length} ${shareRows.length === 1 ? 'member' : 'members'}`
        : 'No split';

    const chartOptions = useMemo(() => {
        if (!purchase) return null;

        const rawPurchaseTs = new Date(purchase.paidAt).getTime();
        const purchaseTs = Number.isFinite(rawPurchaseTs) ? rawPurchaseTs : Date.now();
        const purchaseValue = Math.abs(Number(purchase.amount) || 0);
        const categoryRgb = categoryTheme.accent;
        const chartText = 'rgba(255,255,255,0.72)';
        const chartMuted = 'rgba(255,255,255,0.48)';
        const chartGrid = categoryTheme.rgba(0.14);

        let areaPoints = [];

        if (trendData?.series?.length) {
            areaPoints = trendData.series[0]?.points || [];
        } else if (trendData?.points?.length) {
            areaPoints = trendData.points;
        }

        areaPoints = areaPoints
            .map((point) => [new Date(point.x).getTime(), Math.abs(Number(point.y) || 0)])
            .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
            .sort((a, b) => a[0] - b[0]);

        if (!areaPoints.length) {
            const pad = 1000 * 60 * 60 * 24 * 7;
            areaPoints = [
                [purchaseTs - pad, 0],
                [purchaseTs, purchaseValue],
                [purchaseTs + pad, 0],
            ];
        }

        const firstTs = areaPoints[0]?.[0] ?? purchaseTs;
        const lastTs = areaPoints[areaPoints.length - 1]?.[0] ?? purchaseTs;
        const defaultWindow = 1000 * 60 * 60 * 24 * 30;
        const windowMin = Math.max(firstTs, purchaseTs - defaultWindow);
        const windowMax = Math.min(lastTs, purchaseTs + defaultWindow);
        const hasWindow = Number.isFinite(windowMin) && Number.isFinite(windowMax) && windowMin < windowMax;

        return {
            chart: {
                backgroundColor: 'transparent',
                height: 330,
                spacing: [18, 8, 6, 4],
                style: {
                    fontFamily: 'Inter, system-ui, sans-serif',
                },
            },
            title: { text: null },
            credits: { enabled: false },
            legend: { enabled: false },
            exporting: { enabled: false },
            xAxis: {
                type: 'datetime',
                min: hasWindow ? windowMin : undefined,
                max: hasWindow ? windowMax : undefined,
                lineColor: categoryTheme.rgba(0.2),
                tickColor: categoryTheme.rgba(0.18),
                labels: {
                    style: {
                        color: chartMuted,
                        fontSize: '11px',
                    },
                },
                crosshair: {
                    width: 1,
                    color: categoryTheme.rgba(0.3),
                    dashStyle: 'ShortDot',
                },
                plotLines: [
                    {
                        value: purchaseTs,
                        color: categoryTheme.rgba(0.55),
                        width: 2,
                        dashStyle: 'ShortDash',
                        zIndex: 4,
                        label: {
                            text: 'This purchase',
                            rotation: 0,
                            y: 16,
                            style: {
                                color: chartText,
                                fontSize: '11px',
                                fontWeight: 600,
                            },
                        },
                    },
                ],
            },
            yAxis: {
                min: 0,
                title: { text: null },
                gridLineColor: chartGrid,
                labels: {
                    style: {
                        color: chartMuted,
                        fontSize: '11px',
                    },
                    formatter: function () {
                        return fmtCurrency(this.value);
                    },
                },
            },
            tooltip: {
                shared: true,
                useHTML: true,
                backgroundColor: 'rgba(10,10,16,0.96)',
                borderColor: categoryTheme.rgba(0.38),
                borderRadius: 8,
                shadow: false,
                style: {
                    color: '#fff',
                    fontSize: '13px',
                },
                formatter: function () {
                    const date = Highcharts.dateFormat('%e %b %Y', this.x);
                    const points = this.points?.length ? this.points : this.point ? [this.point] : [];

                    let html = `
                        <div style="display:flex;flex-direction:column;gap:8px;min-width:190px;">
                            <div style="font-size:12px;opacity:.64;">${date}</div>
                    `;

                    points.forEach((point) => {
                        const color = point.color || point.series?.color || categoryRgb;
                        html += `
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:22px;">
                                <span style="display:flex;align-items:center;gap:7px;color:rgba(255,255,255,.78);">
                                    <span style="width:8px;height:8px;border-radius:99px;background:${color};display:inline-block;"></span>
                                    ${point.series.name}
                                </span>
                                <b style="color:#fff;">${fmtCurrency(point.y)}</b>
                            </div>
                        `;
                    });

                    html += '</div>';
                    return html;
                },
            },
            plotOptions: {
                series: {
                    animation: {
                        duration: 1000,
                    },
                    marker: {
                        enabled: false,
                    },
                    states: {
                        hover: {
                            halo: {
                                size: 0,
                                opacity: 0,
                            },
                        },
                        inactive: {
                            opacity: 0.85,
                        },
                    },
                },
                areaspline: {
                    threshold: null,
                    lineWidth: 3,
                    marker: {
                        enabled: false,
                    },
                },
            },
            series: [
                {
                    name: 'Budget spending',
                    type: 'areaspline',
                    data: areaPoints,
                    color: categoryRgb,
                    shadow: false,
                    fillColor: categoryTheme.rgba(0.14),
                    zIndex: 1,
                },
                {
                    name: 'This purchase',
                    type: 'scatter',
                    data: [[purchaseTs, purchaseValue]],
                    color: categoryTheme.accentLight,
                    marker: {
                        enabled: true,
                        radius: 7,
                        lineWidth: 3,
                        lineColor: '#fff',
                        fillColor: categoryRgb,
                        symbol: 'circle',
                    },
                    dataLabels: {
                        enabled: true,
                        format: 'Purchase',
                        crop: false,
                        overflow: 'allow',
                        style: {
                            color: '#fff',
                            textOutline: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                        },
                        y: -14,
                    },
                    zIndex: 5,
                },
            ],
        };
    }, [categoryTheme, purchase, trendData]);

    useEffect(() => {
        if (!purchase || typeof document === 'undefined') return undefined;

        const root = document.documentElement;
        const app = document.querySelector('.app-container');
        const targets = [root, app].filter(Boolean);
        const rootHadThemeClass = root.classList.contains('is-budget-themed');
        const appHadThemeClass = app?.classList.contains('is-themed') ?? false;
        const previousValues = new Map(
            targets.map((target) => [
                target,
                PURCHASE_THEME_KEYS.reduce((acc, key) => {
                    acc[key] = target.style.getPropertyValue(key);
                    return acc;
                }, {}),
            ])
        );

        const applyTheme = () => {
            root.classList.add('is-budget-themed');
            app?.classList.add('is-themed');

            targets.forEach((target) => {
                PURCHASE_THEME_KEYS.forEach((key) => {
                    target.style.setProperty(key, categoryTheme.appStyle[key]);
                });
            });
        };

        applyTheme();

        const timer = typeof window !== 'undefined'
            ? window.setTimeout(applyTheme, 0)
            : null;

        return () => {
            if (timer !== null) window.clearTimeout(timer);

            targets.forEach((target) => {
                const values = previousValues.get(target) || {};

                PURCHASE_THEME_KEYS.forEach((key) => {
                    const budgetValue = budgetTheme?.hasTheme ? budgetTheme.style?.[key] : null;

                    if (budgetValue) {
                        target.style.setProperty(key, budgetValue);
                    } else if (values[key]) {
                        target.style.setProperty(key, values[key]);
                    } else {
                        target.style.removeProperty(key);
                    }
                });
            });

            root.classList.toggle('is-budget-themed', budgetTheme?.hasTheme ?? rootHadThemeClass);
            app?.classList.toggle('is-themed', budgetTheme?.hasTheme ?? appHadThemeClass);
        };
    }, [budgetTheme, categoryTheme, purchase]);

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
        <div className="purchase-details" style={categoryTheme.pageStyle}>
            <div className="purchase-details-top">
                <div className="purchase-details-nav">
                    <Link to={purchasesBackTo} className="purchase-details-back">
                        <span className="material-symbols-rounded" aria-hidden="true">
                            arrow_back
                        </span>
                        Back to purchases
                    </Link>

                    <Link
                        to={`/${slug}/purchases/${purchaseId}/edit`}
                        state={{ purchasesSearch }}
                        className="purchase-details-edit"
                    >
                        <span className="material-symbols-rounded" aria-hidden="true">
                            edit
                        </span>
                        Edit
                    </Link>
                </div>

                <div className="purchase-details-hero">
                    <div className="purchase-details-hero-inner">
                        <div className="purchase-details-heading">
                            <div className="purchase-details-heading-left">
                                <div className="purchase-details-pills" title={categoryLabel}>
                                    {purchaseCategories.length ? (
                                        purchaseCategories.map((category) => (
                                            <span
                                                key={category.id}
                                                className="purchase-details-pill"
                                                style={{
                                                    '--pill-color': toCssColor(category.color, categoryTheme.accent),
                                                }}
                                            >
                                                {category.name}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="purchase-details-pill">
                                            No category
                                        </span>
                                    )}

                                    <span className={`purchase-details-pill ${purchase.shared ? 'is-shared' : 'is-personal'}`}>
                                        {purchase.shared ? 'Shared' : 'Personal'}
                                    </span>

                                    {purchase.notes && (
                                        <span className="purchase-details-pill has-note">
                                            Note added
                                        </span>
                                    )}
                                </div>

                                <h1>{purchase.itemName || 'Untitled purchase'}</h1>
                            </div>

                            <div className="purchase-details-amount">
                                <span>Total</span>
                                <strong>{fmtCurrency(purchaseAmount)}</strong>
                            </div>
                        </div>

                        <div className="purchase-details-hero-meta">
                            <div className="purchase-details-hero-meta-item is-person">
                                <Avatar
                                    user={purchase.paidBy}
                                    size="2.55rem"
                                    n={3.25}
                                    version={avatarVersionOf(purchase.paidBy)}
                                    alt={nameOf(purchase.paidBy)}
                                    fallbackSrc="/images/avatar-placeholder.jpg"
                                />

                                <div>
                                    <span>Paid by</span>
                                    <strong>{nameOf(purchase.paidBy)}</strong>
                                </div>
                            </div>

                            <div className="purchase-details-hero-meta-item">
                                <span>Paid on</span>
                                <strong>{fmtDateTime(purchase.paidAt)}</strong>
                            </div>

                            <div className="purchase-details-hero-meta-item">
                                <span>Split</span>
                                <strong>{purchase.shared ? splitSummary : 'Personal purchase'}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="purchase-details-grid">
                {chartOptions && (
                    <div className="purchase-details-card purchase-details-card-chart">
                        <div className="purchase-details-card-head purchase-details-chart-head">
                            <div>
                                <h3>Spending timeline</h3>
                                <p>How this purchase sits in the budget history.</p>
                            </div>

                            <div className="purchase-details-chart-badge">
                                <span>This purchase</span>
                                <strong>{fmtCurrency(absolutePurchaseAmount)}</strong>
                            </div>
                        </div>

                        <div className="purchase-details-chart-shell">
                            <HighchartsReact
                                highcharts={Highcharts}
                                options={chartOptions}
                            />
                        </div>
                    </div>
                )}

                <div className="purchase-details-card purchase-details-card-overview">
                    <div className="purchase-details-card-head">
                        <div>
                            <h3>Overview</h3>
                            <p>Main information about this purchase.</p>
                        </div>
                    </div>

                    <div className="purchase-details-list">
                        <div className="purchase-details-list-row">
                            <span>Category</span>
                            <strong>{categoryLabel}</strong>
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
                            <span>Split</span>
                            <strong>{purchase.shared ? splitSummary : 'No'}</strong>
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
                </div>

                <div className="purchase-details-card purchase-details-card-notes">
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
                </div>

                <div className="purchase-details-card purchase-details-card-wide">
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
                            {shareRows.map((share) => (
                                <div key={`${purchase.id}-${share.userId}`} className="purchase-details-share-row">
                                    <div className="purchase-details-share-user">
                                        <div className="purchase-details-share-user-top">
                                            <Avatar
                                                user={share.user}
                                                size="2.6rem"
                                                n={3.25}
                                                version={avatarVersionOf(share.user)}
                                                alt={nameOf(share.user)}
                                                fallbackSrc="/images/avatar-placeholder.jpg"
                                            />

                                            <strong>{nameOf(share.user)}</strong>
                                        </div>

                                        <div className="purchase-details-share-meta">
                                            {share.fixedAmount != null ? 'Fixed amount' : `${share.percent}% share`}
                                        </div>
                                    </div>

                                    <div className="purchase-details-share-values">
                                        <strong>{fmtCurrency(share.computedAmount)}</strong>

                                        <span className={`purchase-details-share-status ${share.isSettled ? 'is-settled' : 'is-open'}`}>
                                            {share.isSettled
                                                ? `Settled${share.settledAt ? ` - ${fmtDateOnly(share.settledAt)}` : ''}`
                                                : 'Open'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
