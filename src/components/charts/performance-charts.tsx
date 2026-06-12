"use client";

import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

type ProfitLossPoint = {
  label: string;
  user: number;
  codex: number;
};

type MarketChartPoint = {
  label: string;
  profitLoss: number;
  openExposure: number;
};

const chartColors = {
  user: "#2563eb",
  codex: "#f97316",
  profit: "#16a34a",
  exposure: "#64748b",
  axis: "#71717a",
  grid: "#d4d4d8",
  legend: "#3f3f46",
};

const moneyAxisLabel = {
  formatter: (value: number) => `¥${value.toFixed(0)}`,
};

export function ProfitLossChart({ points }: { points: ProfitLossPoint[] }) {
  const option = {
    backgroundColor: "transparent",
    color: [chartColors.user, chartColors.codex],
    grid: { left: 48, right: 20, top: 32, bottom: 28 },
    legend: {
      top: 0,
      itemWidth: 18,
      itemHeight: 10,
      textStyle: { color: chartColors.legend, fontWeight: 600 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => `¥${value.toFixed(2)}`,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: chartColors.axis } },
      axisLabel: { color: chartColors.axis, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      axisLabel: moneyAxisLabel,
      axisLine: { lineStyle: { color: chartColors.axis } },
      splitLine: { lineStyle: { color: chartColors.grid, width: 1 } },
    },
    series: [
      {
        type: "line",
        name: "User 累计盈亏",
        data: points.map((point) => point.user),
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { color: chartColors.user, width: 3 },
        itemStyle: { color: chartColors.user, borderColor: "#ffffff", borderWidth: 2 },
        emphasis: { focus: "series", lineStyle: { width: 4 } },
      },
      {
        type: "line",
        name: "Codex 累计盈亏",
        data: points.map((point) => point.codex),
        smooth: true,
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

export function MarketBreakdownChart({ points }: { points: MarketChartPoint[] }) {
  const option = {
    backgroundColor: "transparent",
    color: [chartColors.profit, chartColors.exposure],
    grid: { left: 48, right: 16, top: 28, bottom: 40 },
    legend: {
      top: 0,
      textStyle: { color: chartColors.legend, fontWeight: 600 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => `¥${value.toFixed(2)}`,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: chartColors.axis } },
      axisLabel: { color: chartColors.axis, interval: 0, rotate: points.length > 3 ? 20 : 0 },
    },
    yAxis: {
      type: "value",
      axisLabel: moneyAxisLabel,
      axisLine: { lineStyle: { color: chartColors.axis } },
      splitLine: { lineStyle: { color: chartColors.grid, width: 1 } },
    },
    series: [
      {
        type: "bar",
        name: "已结算盈亏",
        data: points.map((point) => point.profitLoss),
        itemStyle: { color: chartColors.profit },
      },
      {
        type: "bar",
        name: "未结算敞口",
        data: points.map((point) => point.openExposure),
        itemStyle: { color: chartColors.exposure },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}
