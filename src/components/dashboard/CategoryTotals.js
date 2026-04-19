import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { api } from "../../lib/api";

const numberFmt = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1
});

export default function CategoryTotals() {
    const { slug } = useParams();

    const [data, setData] = useState(null);
    const [period, setPeriod] = useState("month");

    useEffect(() => {
        let ignore = false;

        (async () => {
            try {
                const { data } = await api.get(
                    `/reports/${encodeURIComponent(slug)}/category-totals?period=${period}`,
                    { withCredentials: true }
                );

                if (!ignore) setData(data);
            } catch (e) {
                console.error(e);
            }
        })();

        return () => { ignore = true; };
    }, [slug, period]);

    const chartOptions = useMemo(() => ({
        chart: {
            type: "column",
            backgroundColor: "transparent",
            height: 400
        },

        title: { text: null },

        xAxis: {
            type: "category",
            labels: {
                style: { color: "#ccc" }
            }
        },

        yAxis: {
            title: { text: null }
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

        series: [{
            colorByPoint: true,
            data: data?.items?.map(cat => ({
                name: cat.name,
                y: cat.total,
                color: `rgb(${cat.color})`,
            })) || []
        }]

    }), [data]);

    const labels = {
        week: "Week",
        month: "This Month",
        lastMonth: "Last Month",
        all: "All Time"
    };

    return (
        <div className="highcharts">
            <div style={{ display: "flex", gap: "0.5em", marginBottom: "1em" }}>
                {["week", "month", "lastMonth", "all"].map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
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
            <HighchartsReact
                highcharts={Highcharts}
                options={chartOptions}
            />
        </div>
    );
}