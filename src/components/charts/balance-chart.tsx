"use client";

import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

type BalancePoint = {
  label: string;
  user?: number;
  codex?: number;
};

const chartColors = {
  user: "#2563eb",
  codex: "#f97316",
  axis: "#71717a",
  grid: "#d4d4d8",
  legend: "#3f3f46",
};

export function BalanceChart({ points }: { points: BalancePoint[] }) {
  const option = {
    backgroundColor: "transparent",
    color: [chartColors.user, chartColors.codex],
    grid: { left: 44, right: 20, top: 32, bottom: 28 },
    legend: {
      top: 0,
      itemWidth: 18,
      itemHeight: 10,
      textStyle: { color: chartColors.legend, fontWeight: 600 },
    },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: chartColors.axis } },
      axisLabel: { color: chartColors.axis, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: chartColors.axis } },
      axisLabel: { color: chartColors.axis },
      splitLine: { lineStyle: { color: chartColors.grid, width: 1 } },
    },
    series: [
      {
        type: "line",
        name: "User",
        data: points.map((point) => point.user ?? null),
        smooth: true,
        connectNulls: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { color: chartColors.user, width: 3 },
        itemStyle: { color: chartColors.user, borderColor: "#ffffff", borderWidth: 2 },
        emphasis: { focus: "series", lineStyle: { width: 4 } },
      },
      {
        type: "line",
        name: "Codex",
        data: points.map((point) => point.codex ?? null),
        smooth: true,
        connectNulls: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { color: chartColors.codex, width: 3 },
        itemStyle: { color: chartColors.codex, borderColor: "#ffffff", borderWidth: 2 },
        emphasis: { focus: "series", lineStyle: { width: 4 } },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}
