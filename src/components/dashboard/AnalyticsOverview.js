import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { getBudgetTheme } from '../../lib/budgetTheme';
import usePalette from '../hooks/usePalette';
import DashboardLayoutEditor from './DashboardLayoutEditor';

Highcharts.setOptions({
    chart: {
        animation: {
            duration: 900,
            easing: 'easeOutQuart',
        },
        style: {
            fontFamily: 'Inter, system-ui, sans-serif',
        },
    },
    lang: {
        thousandsSep: ' ',
    },
});

const PERIODS = [
    { value: 'month', label: 'This month' },
    { value: 'quarter', label: '3 months' },
    { value: 'year', label: '12 months' },
    { value: 'all', label: 'All time' },
];

const PERIOD_VALUES = new Set(PERIODS.map((period) => period.value));

const fallbackChartColors = {
    blue: '#7a9fec',
    teal: '#5eead4',
    green: '#7ddc8a',
    yellow: '#f4bd61',
    red: '#f87171',
    gray: '#9ca3af',
    purple: '#a78bfa',
};

function buildChartColors(themeColors = {}, palette = null) {
    const paletteColors = palette?.source === 'image' ? palette.chartPalette || [] : [];
    const pick = (index, fallback) => paletteColors[index] || fallback;
    const colors = {
        blue: pick(0, themeColors.accent || fallbackChartColors.blue),
        teal: pick(1, themeColors.accentStrong || fallbackChartColors.teal),
        green: pick(2, themeColors.accentMuted || fallbackChartColors.green),
        yellow: pick(3, themeColors.accentLight || fallbackChartColors.yellow),
        purple: pick(4, themeColors.accentDark || fallbackChartColors.purple),
        red: pick(5, fallbackChartColors.red),
        gray: themeColors.gray || fallbackChartColors.gray,
    };

    return {
        ...colors,
        palette: [
            colors.blue,
            colors.teal,
            colors.green,
            colors.yellow,
            colors.purple,
            colors.red,
            colors.gray,
            ...paletteColors,
        ],
    };
}

const moneyFmt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const compactMoneyFmt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
});

const numberFmt = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
});

function formatMoney(value, compact = false) {
    return (compact ? compactMoneyFmt : moneyFmt).format(Number(value || 0));
}

function formatNumber(value) {
    return numberFmt.format(Number(value || 0));
}

function colorFromValue(value, fallback = fallbackChartColors.gray) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    const triplet = raw.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
    if (triplet) return `rgb(${triplet[1]}, ${triplet[2]}, ${triplet[3]})`;

    return raw;
}

function toDateData(points, key) {
    return (points || []).map((point) => [
        new Date(point.x).getTime(),
        Number(point[key] || 0),
    ]);
}

function topWithOther(items, valueKey, limit = 8, palette = []) {
    const positive = (items || [])
        .filter((item) => Number(item[valueKey] || 0) > 0)
        .sort((a, b) => Number(b[valueKey] || 0) - Number(a[valueKey] || 0));

    const top = positive.slice(0, limit);
    const rest = positive.slice(limit);
    const restTotal = rest.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0);

    const mapped = top.map((item, index) => ({
        name: item.name,
        y: Number(item[valueKey] || 0),
        color: colorFromValue(item.color, palette[index % palette.length]),
    }));

    if (restTotal > 0) {
        mapped.push({
            name: 'Other',
            y: restTotal,
            color: 'rgba(255, 255, 255, 0.35)',
        });
    }

    return mapped;
}

function sharedMoneyTooltip() {
    const date = Highcharts.dateFormat('%b %e, %Y', this.x);
    const rows = (this.points || [])
        .map((point) => `
            <div class="analytics-tooltip-row">
                <span style="color:${point.color}">${point.series.name}</span>
                <strong>${formatMoney(point.y)}</strong>
            </div>
        `)
        .join('');

    return `
        <div class="analytics-tooltip">
            <div class="analytics-tooltip-date">${date}</div>
            ${rows}
        </div>
    `;
}

function sharedNumberTooltip() {
    const date = Highcharts.dateFormat('%b %e, %Y', this.x);
    const rows = (this.points || [])
        .map((point) => {
            const value = point.series.userOptions.valueType === 'money'
                ? formatMoney(point.y)
                : formatNumber(point.y);

            return `
                <div class="analytics-tooltip-row">
                    <span style="color:${point.color}">${point.series.name}</span>
                    <strong>${value}</strong>
                </div>
            `;
        })
        .join('');

    return `
        <div class="analytics-tooltip">
            <div class="analytics-tooltip-date">${date}</div>
            ${rows}
        </div>
    `;
}

function baseChartOptions(height = 360) {
    return {
        chart: {
            backgroundColor: 'transparent',
            height,
            spacing: [12, 12, 12, 12],
        },
        title: { text: null },
        credits: { enabled: false },
        legend: {
            itemStyle: { color: 'rgba(255,255,255,0.72)' },
            itemHoverStyle: { color: '#fff' },
        },
        xAxis: {
            labels: { style: { color: 'rgba(255,255,255,0.55)' } },
            lineColor: 'rgba(255,255,255,0.08)',
            tickColor: 'rgba(255,255,255,0.08)',
        },
        yAxis: {
            title: { text: null },
            labels: { style: { color: 'rgba(255,255,255,0.55)' } },
            gridLineColor: 'rgba(255,255,255,0.06)',
        },
        tooltip: {
            shared: true,
            useHTML: true,
            backgroundColor: 'rgba(10, 10, 18, 0.96)',
            borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 8,
            shadow: false,
            style: { color: '#fff' },
        },
        plotOptions: {
            column: {
                borderRadius: 5,
                borderWidth: 0,
            },
            bar: {
                borderRadius: 5,
                borderWidth: 0,
            },
            series: {
                marker: {
                    enabled: false,
                    states: { hover: { enabled: true, radius: 4 } },
                },
            },
        },
    };
}

function ChartCard({ title, subtitle, children, className = '' }) {
    return (
        <section className={`highcharts analytics-chart-card ${className}`}>
            <div className="analytics-chart-card-head">
                <h3 className="hc-title">{title}</h3>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {children}
        </section>
    );
}

function SummaryCards({ cards }) {
    return (
        <div className="analytics-summary-grid">
            {cards.map((card) => (
                <div key={card.label} className={`analytics-summary-card ${card.tone ? `is-${card.tone}` : ''}`}>
                    <div className="analytics-summary-card-icon material-symbols-rounded" aria-hidden="true">
                        {card.icon || 'monitoring'}
                    </div>
                    <div className="analytics-summary-card-copy">
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                        {card.detail && <p>{card.detail}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function PeriodControls({ period, onChange }) {
    return (
        <div className="analytics-periods" aria-label="Chart period">
            {PERIODS.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    className={`analytics-period-button ${period === item.value ? 'is-active' : ''}`}
                    onClick={() => onChange(item.value)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

function rangeLabel(data, period) {
    if (period === 'all') return 'All recorded data';
    const from = data?.range?.from ? new Date(data.range.from) : null;
    const to = data?.range?.to ? new Date(data.range.to) : null;
    if (!from || !to) return 'Selected period';

    const formatter = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: period === 'month' ? 'numeric' : undefined,
        year: 'numeric',
    });

    return `${formatter.format(from)} - ${formatter.format(to)}`;
}

function AnalyticsCharts({ data, colors, layoutId }) {
    const charts = useMemo(() => {
        const chartColors = colors;
        const trend = data?.trend || [];
        const categories = data?.categories || [];
        const memberTotals = data?.memberTotals || [];
        const sharedVsPersonal = data?.sharedVsPersonal || [];

        const spendingFlow = {
            ...baseChartOptions(420),
            chart: {
                ...baseChartOptions(420).chart,
                zoomType: 'x',
            },
            xAxis: {
                ...baseChartOptions().xAxis,
                type: 'datetime',
                crosshair: { color: 'rgba(255,255,255,0.12)' },
            },
            yAxis: {
                ...baseChartOptions().yAxis,
                labels: {
                    ...baseChartOptions().yAxis.labels,
                    formatter: function () {
                        return formatMoney(this.value, true);
                    },
                },
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                formatter: sharedMoneyTooltip,
            },
            series: [
                {
                    name: 'Total spending',
                    type: 'column',
                    data: toDateData(trend, 'totalSpending'),
                    color: chartColors.blue,
                },
                {
                    name: 'My responsibility',
                    type: 'spline',
                    data: toDateData(trend, 'myResponsibility'),
                    color: chartColors.yellow,
                    lineWidth: 3,
                },
                {
                    name: 'I paid',
                    type: 'spline',
                    data: toDateData(trend, 'myPaid'),
                    color: chartColors.teal,
                    dashStyle: 'ShortDash',
                    lineWidth: 3,
                },
                {
                    name: 'Income',
                    type: 'column',
                    data: toDateData(trend, 'totalIncome'),
                    color: chartColors.green,
                    opacity: 0.5,
                },
            ],
        };

        const categoryDonut = {
            ...baseChartOptions(360),
            chart: {
                ...baseChartOptions(360).chart,
                type: 'pie',
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                pointFormatter: function () {
                    return `<span style="color:${this.color}">●</span> ${this.name}: <strong>${formatMoney(this.y)}</strong>`;
                },
            },
            plotOptions: {
                pie: {
                    innerSize: '58%',
                    borderWidth: 0,
                    dataLabels: {
                        enabled: true,
                        distance: 14,
                        style: {
                            color: 'rgba(255,255,255,0.72)',
                            textOutline: 'none',
                            fontSize: '11px',
                        },
                        formatter: function () {
                            return this.percentage >= 5 ? this.point.name : null;
                        },
                    },
                },
            },
            series: [{
                name: 'Spending',
                data: topWithOther(categories, 'total', 8, chartColors.palette),
            }],
        };

        const memberComparison = {
            ...baseChartOptions(Math.max(360, memberTotals.length * 62)),
            chart: {
                ...baseChartOptions(Math.max(360, memberTotals.length * 62)).chart,
                type: 'bar',
            },
            xAxis: {
                ...baseChartOptions().xAxis,
                categories: memberTotals.map((member) => member.user.name),
            },
            yAxis: {
                ...baseChartOptions().yAxis,
                labels: {
                    ...baseChartOptions().yAxis.labels,
                    formatter: function () {
                        return formatMoney(this.value, true);
                    },
                },
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                pointFormatter: function () {
                    return `<span style="color:${this.color}">●</span> ${this.series.name}: <strong>${formatMoney(this.y)}</strong><br/>`;
                },
            },
            series: [
                {
                    name: 'Paid',
                    data: memberTotals.map((member) => Number(member.paid || 0)),
                    color: chartColors.teal,
                },
                {
                    name: 'Responsible for',
                    data: memberTotals.map((member) => Number(member.responsibility || 0)),
                    color: chartColors.yellow,
                },
                {
                    name: 'Income',
                    data: memberTotals.map((member) => Number(member.income || 0)),
                    color: chartColors.green,
                },
            ],
        };

        const sharedSplit = {
            ...baseChartOptions(320),
            chart: {
                ...baseChartOptions(320).chart,
                type: 'pie',
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                pointFormatter: function () {
                    return `<span style="color:${this.color}">●</span> ${this.name}: <strong>${formatMoney(this.y)}</strong>`;
                },
            },
            plotOptions: {
                pie: {
                    innerSize: '62%',
                    borderWidth: 0,
                    dataLabels: {
                        enabled: true,
                        style: {
                            color: 'rgba(255,255,255,0.72)',
                            textOutline: 'none',
                        },
                        formatter: function () {
                            return `${this.point.name}<br/><strong>${formatMoney(this.y, true)}</strong>`;
                        },
                    },
                },
            },
            series: [{
                name: 'Split',
                data: sharedVsPersonal
                    .filter((item) => Number(item.total || 0) > 0)
                    .map((item, index) => ({
                        name: item.name,
                        y: Number(item.total || 0),
                        color: chartColors.palette[index % chartColors.palette.length],
                    })),
            }],
        };

        return {
            spendingFlow,
            categoryDonut,
            memberComparison,
            sharedSplit,
        };
    }, [colors, data]);

    const items = useMemo(() => ([
        {
            id: 'spending-flow',
            title: 'Spending, income, and my share',
            layout: { x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
            content: (
                <ChartCard
                    title="Spending, income, and my share"
                    subtitle="Total spending beside what you paid and what you were responsible for."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.spendingFlow} />
                </ChartCard>
            ),
        },
        {
            id: 'category-mix',
            title: 'Category mix',
            layout: { x: 0, y: 6, w: 5, h: 5, minW: 4, minH: 4 },
            content: (
                <ChartCard
                    title="Category mix"
                    subtitle="Where the selected period went."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.categoryDonut} />
                </ChartCard>
            ),
        },
        {
            id: 'people-comparison',
            title: 'People comparison',
            layout: { x: 5, y: 6, w: 7, h: 5, minW: 5, minH: 4 },
            content: (
                <ChartCard
                    title="People comparison"
                    subtitle="Paid, responsibility, and income by member."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.memberComparison} />
                </ChartCard>
            ),
        },
        {
            id: 'shared-personal',
            title: 'Shared vs personal',
            layout: { x: 0, y: 11, w: 5, h: 4, minW: 4, minH: 3 },
            content: (
                <ChartCard
                    title="Shared vs personal"
                    subtitle="How much of the spending was actually shared."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.sharedSplit} />
                </ChartCard>
            ),
        },
    ]), [charts]);

    return (
        <DashboardLayoutEditor
            layoutId={layoutId}
            items={items}
        />
    );
}

function StatisticsCharts({ data, colors, layoutId }) {
    const charts = useMemo(() => {
        const chartColors = colors;
        const trend = data?.trend || [];
        const categoryTrend = data?.categoryTrend || [];
        const weekday = data?.weekday || [];
        const topPurchases = data?.topPurchases || [];
        const memberTotals = data?.memberTotals || [];
        const categories = data?.categories || [];

        const categoryStack = {
            ...baseChartOptions(430),
            chart: {
                ...baseChartOptions(430).chart,
                type: 'area',
                zoomType: 'x',
            },
            xAxis: {
                ...baseChartOptions().xAxis,
                type: 'datetime',
                crosshair: { color: 'rgba(255,255,255,0.12)' },
            },
            yAxis: {
                ...baseChartOptions().yAxis,
                labels: {
                    ...baseChartOptions().yAxis.labels,
                    formatter: function () {
                        return formatMoney(this.value, true);
                    },
                },
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                formatter: sharedMoneyTooltip,
            },
            plotOptions: {
                ...baseChartOptions().plotOptions,
                area: {
                    stacking: 'normal',
                    marker: { enabled: false },
                    lineWidth: 2,
                    fillOpacity: 0.24,
                },
            },
            series: categoryTrend.map((category, index) => ({
                name: category.name,
                data: toDateData(category.points, 'y'),
                color: colorFromValue(category.color, chartColors.palette[index % chartColors.palette.length]),
            })),
        };

        const weekdayOptions = {
            ...baseChartOptions(360),
            chart: {
                ...baseChartOptions(360).chart,
                type: 'column',
            },
            xAxis: {
                ...baseChartOptions().xAxis,
                categories: weekday.map((day) => day.label),
            },
            yAxis: {
                ...baseChartOptions().yAxis,
                labels: {
                    ...baseChartOptions().yAxis.labels,
                    formatter: function () {
                        return formatMoney(this.value, true);
                    },
                },
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                pointFormatter: function () {
                    return `<span style="color:${this.color}">●</span> ${this.series.name}: <strong>${formatMoney(this.y)}</strong><br/>`;
                },
            },
            series: [
                {
                    name: 'Total spending',
                    data: weekday.map((day) => Number(day.total || 0)),
                    color: chartColors.blue,
                },
                {
                    name: 'My responsibility',
                    data: weekday.map((day) => Number(day.myResponsibility || 0)),
                    color: chartColors.yellow,
                },
            ],
        };

        const volumeOptions = {
            ...baseChartOptions(360),
            chart: {
                ...baseChartOptions(360).chart,
                zoomType: 'x',
            },
            xAxis: {
                ...baseChartOptions().xAxis,
                type: 'datetime',
                crosshair: { color: 'rgba(255,255,255,0.12)' },
            },
            yAxis: [
                {
                    ...baseChartOptions().yAxis,
                    labels: {
                        ...baseChartOptions().yAxis.labels,
                        formatter: function () {
                            return formatNumber(this.value);
                        },
                    },
                },
                {
                    ...baseChartOptions().yAxis,
                    opposite: true,
                    labels: {
                        ...baseChartOptions().yAxis.labels,
                        formatter: function () {
                            return formatMoney(this.value, true);
                        },
                    },
                },
            ],
            tooltip: {
                ...baseChartOptions().tooltip,
                formatter: sharedNumberTooltip,
            },
            series: [
                {
                    name: 'Purchases',
                    type: 'column',
                    data: toDateData(trend, 'purchaseCount'),
                    color: chartColors.teal,
                    valueType: 'number',
                },
                {
                    name: 'Average purchase',
                    type: 'spline',
                    yAxis: 1,
                    data: toDateData(trend, 'avgPurchase'),
                    color: chartColors.yellow,
                    lineWidth: 3,
                    valueType: 'money',
                },
            ],
        };

        const topPurchaseOptions = {
            ...baseChartOptions(Math.max(360, topPurchases.length * 42)),
            chart: {
                ...baseChartOptions(Math.max(360, topPurchases.length * 42)).chart,
                type: 'bar',
            },
            xAxis: {
                ...baseChartOptions().xAxis,
                categories: topPurchases.map((purchase) => purchase.itemName),
                labels: {
                    ...baseChartOptions().xAxis.labels,
                    style: {
                        ...baseChartOptions().xAxis.labels.style,
                        width: 150,
                    },
                },
            },
            yAxis: {
                ...baseChartOptions().yAxis,
                labels: {
                    ...baseChartOptions().yAxis.labels,
                    formatter: function () {
                        return formatMoney(this.value, true);
                    },
                },
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                pointFormatter: function () {
                    const purchase = topPurchases[this.index];
                    return `
                        <strong>${purchase?.itemName || this.category}</strong><br/>
                        Paid by ${purchase?.paidBy?.name || 'Unknown'}<br/>
                        <span style="color:${this.color}">●</span> ${formatMoney(this.y)}
                    `;
                },
            },
            series: [{
                name: 'Amount',
                data: topPurchases.map((purchase, index) => ({
                    y: Number(purchase.amount || 0),
                    color: chartColors.palette[index % chartColors.palette.length],
                })),
            }],
        };

        const responsibilityPie = {
            ...baseChartOptions(340),
            chart: {
                ...baseChartOptions(340).chart,
                type: 'pie',
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                pointFormatter: function () {
                    return `<span style="color:${this.color}">●</span> ${this.name}: <strong>${formatMoney(this.y)}</strong>`;
                },
            },
            plotOptions: {
                pie: {
                    innerSize: '56%',
                    borderWidth: 0,
                    dataLabels: {
                        enabled: true,
                        style: {
                            color: 'rgba(255,255,255,0.72)',
                            textOutline: 'none',
                        },
                        formatter: function () {
                            return this.percentage >= 6 ? this.point.name : null;
                        },
                    },
                },
            },
            series: [{
                name: 'Responsibility',
                data: memberTotals
                    .filter((member) => Number(member.responsibility || 0) > 0)
                    .map((member, index) => ({
                        name: member.user.name,
                        y: Number(member.responsibility || 0),
                        color: chartColors.palette[index % chartColors.palette.length],
                    })),
            }],
        };

        const categoryBar = {
            ...baseChartOptions(Math.max(360, Math.min(10, categories.length) * 50)),
            chart: {
                ...baseChartOptions(Math.max(360, Math.min(10, categories.length) * 50)).chart,
                type: 'bar',
            },
            xAxis: {
                ...baseChartOptions().xAxis,
                categories: categories
                    .filter((category) => Number(category.total || 0) > 0)
                    .slice(0, 10)
                    .map((category) => category.name),
            },
            yAxis: {
                ...baseChartOptions().yAxis,
                labels: {
                    ...baseChartOptions().yAxis.labels,
                    formatter: function () {
                        return formatMoney(this.value, true);
                    },
                },
            },
            tooltip: {
                ...baseChartOptions().tooltip,
                pointFormatter: function () {
                    return `<span style="color:${this.color}">●</span> ${this.series.name}: <strong>${formatMoney(this.y)}</strong><br/>`;
                },
            },
            series: [
                {
                    name: 'Total',
                    data: categories
                        .filter((category) => Number(category.total || 0) > 0)
                        .slice(0, 10)
                        .map((category, index) => ({
                            y: Number(category.total || 0),
                            color: colorFromValue(category.color, chartColors.palette[index % chartColors.palette.length]),
                        })),
                },
                {
                    name: 'My share',
                    data: categories
                        .filter((category) => Number(category.total || 0) > 0)
                        .slice(0, 10)
                        .map((category) => Number(category.myResponsibility || 0)),
                    color: chartColors.yellow,
                },
            ],
        };

        return {
            categoryStack,
            weekdayOptions,
            volumeOptions,
            topPurchaseOptions,
            responsibilityPie,
            categoryBar,
        };
    }, [colors, data]);

    const items = useMemo(() => ([
        {
            id: 'category-trend',
            title: 'Category trend',
            layout: { x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
            content: (
                <ChartCard
                    title="Category trend"
                    subtitle="The top categories stacked through time."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.categoryStack} />
                </ChartCard>
            ),
        },
        {
            id: 'weekday-pattern',
            title: 'Weekday pattern',
            layout: { x: 0, y: 6, w: 6, h: 5, minW: 4, minH: 4 },
            content: (
                <ChartCard
                    title="Weekday pattern"
                    subtitle="Which days tend to carry the spending."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.weekdayOptions} />
                </ChartCard>
            ),
        },
        {
            id: 'purchase-volume',
            title: 'Purchase volume',
            layout: { x: 6, y: 6, w: 6, h: 5, minW: 4, minH: 4 },
            content: (
                <ChartCard
                    title="Purchase volume"
                    subtitle="How many purchases happened and how large they were on average."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.volumeOptions} />
                </ChartCard>
            ),
        },
        {
            id: 'largest-purchases',
            title: 'Largest purchases',
            layout: { x: 0, y: 11, w: 7, h: 6, minW: 5, minH: 4 },
            content: (
                <ChartCard
                    title="Largest purchases"
                    subtitle="The biggest individual purchases in this period."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.topPurchaseOptions} />
                </ChartCard>
            ),
        },
        {
            id: 'responsibility-split',
            title: 'Responsibility split',
            layout: { x: 7, y: 11, w: 5, h: 4, minW: 4, minH: 3 },
            content: (
                <ChartCard
                    title="Responsibility split"
                    subtitle="Who was responsible for the spending."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.responsibilityPie} />
                </ChartCard>
            ),
        },
        {
            id: 'top-categories',
            title: 'Top categories',
            layout: { x: 0, y: 17, w: 6, h: 5, minW: 4, minH: 4 },
            content: (
                <ChartCard
                    title="Top categories"
                    subtitle="Total category spend compared with your share."
                >
                    <HighchartsReact highcharts={Highcharts} options={charts.categoryBar} />
                </ChartCard>
            ),
        },
    ]), [charts]);

    return (
        <DashboardLayoutEditor
            layoutId={layoutId}
            items={items}
        />
    );
}

export default function AnalyticsOverview({
    budget,
    view = 'analytics',
    theme: providedTheme = null,
    palette: providedPalette = null,
}) {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedPeriod = searchParams.get('period') || 'year';
    const period = PERIOD_VALUES.has(requestedPeriod) ? requestedPeriod : 'year';
    const localPalette = usePalette(providedPalette ? null : budget?.bannerUrl);
    const palette = providedPalette || localPalette;
    const theme = useMemo(
        () => providedTheme || getBudgetTheme(budget, palette),
        [budget, palette, providedTheme]
    );
    const chartColors = useMemo(
        () => buildChartColors(theme.colors, palette),
        [palette, theme]
    );

    const {
        data = null,
        error,
        isLoading,
    } = useQuery({
        queryKey: queryKeys.reports.analyticsOverview(slug, period),
        enabled: !!slug && !!period,
        queryFn: async () => {
            const { data } = await api.get(
                `/reports/${encodeURIComponent(slug)}/analytics-overview`,
                { params: { period }, withCredentials: true }
            );
            return data;
        },
    });

    const handlePeriodChange = (nextPeriod) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('period', nextPeriod);
        setSearchParams(nextParams, { replace: true });
    };

    const summary = data?.summary || {};
    const cards = view === 'statistics'
        ? [
            {
                label: 'Purchases',
                value: formatNumber(summary.purchaseCount),
                detail: `${formatMoney(summary.avgPurchase)} average`,
                tone: 'blue',
                icon: 'receipt_long',
            },
            {
                label: 'Shared spending',
                value: formatMoney(summary.sharedSpending),
                detail: 'Purchases split across members',
                tone: 'teal',
                icon: 'groups',
            },
            {
                label: 'Personal spending',
                value: formatMoney(summary.personalSpending),
                detail: 'Purchases assigned to one person',
                tone: 'gray',
                icon: 'person',
            },
            {
                label: 'Net cashflow',
                value: formatMoney(summary.netCashflow),
                detail: 'Income minus total spending',
                tone: Number(summary.netCashflow || 0) >= 0 ? 'green' : 'red',
                icon: 'account_balance_wallet',
            },
        ]
        : [
            {
                label: 'Total spending',
                value: formatMoney(summary.totalSpending),
                detail: rangeLabel(data, period),
                tone: 'blue',
                icon: 'payments',
            },
            {
                label: 'My responsibility',
                value: formatMoney(summary.myResponsibility),
                detail: `${formatMoney(summary.myNetCashflow)} after my income`,
                tone: Number(summary.myNetCashflow || 0) >= 0 ? 'green' : 'yellow',
                icon: 'person_check',
            },
            {
                label: 'I paid',
                value: formatMoney(summary.myPaid),
                detail: 'Cash that left my account',
                tone: 'teal',
                icon: 'credit_card',
            },
            {
                label: 'Income',
                value: formatMoney(summary.totalIncome),
                detail: `${formatMoney(summary.myIncome)} recorded for me`,
                tone: 'green',
                icon: 'trending_up',
            },
        ];

    const pageTitle = view === 'statistics' ? 'Statistics' : 'Analytics';
    const pageSubtitle = view === 'statistics'
        ? 'Patterns, distribution, and outliers for the selected spending window.'
        : 'A clearer view of total spending, your share, who paid, and where the money went.';

    const errorMessage = error?.response?.data?.error || error?.message || 'Could not load analytics.';

    return (
        <div className={`analytics-overview analytics-overview-${view}`} style={theme.style}>
            <header className={`analytics-header ${budget?.bannerUrl ? 'has-banner' : ''}`}>
                {budget?.bannerUrl && (
                    <img
                        className="analytics-header-banner"
                        src={budget.bannerUrl}
                        alt=""
                        aria-hidden="true"
                    />
                )}
                <div className="analytics-header-overlay" />

                <div className="analytics-header-content">
                    <div className="analytics-header-copy">
                        <p className="analytics-eyebrow">{budget?.name || 'Budget'}</p>
                        <h1>{pageTitle}</h1>
                        <p>{pageSubtitle}</p>
                    </div>

                    <div className="analytics-header-actions">
                        <PeriodControls period={period} onChange={handlePeriodChange} />
                    </div>
                </div>
            </header>

            {isLoading ? (
                <div className="analytics-loading">
                    <div />
                    <div />
                    <div />
                </div>
            ) : error ? (
                <div className="analytics-error">
                    {errorMessage}
                </div>
            ) : (
                <>
                    <SummaryCards cards={cards} />
                    {view === 'statistics' ? (
                        <StatisticsCharts
                            data={data}
                            colors={chartColors}
                            layoutId={`${slug || 'budget'}:statistics`}
                        />
                    ) : (
                        <AnalyticsCharts
                            data={data}
                            colors={chartColors}
                            layoutId={`${slug || 'budget'}:analytics`}
                        />
                    )}
                </>
            )}
        </div>
    );
}
