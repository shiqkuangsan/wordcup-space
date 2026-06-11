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

const moneyAxisLabel = {
  formatter: (value: number) => `¥${value.toFixed(0)}`,
};

export function ProfitLossChart({ points }: { points: ProfitLossPoint[] }) {
  const option = {
    backgroundColor: "transparent",
    grid: { left: 48, right: 16, top: 28, bottom: 24 },
    legend: {
      top: 0,
      textStyle: { color: "#a3a3a3" },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => `¥${value.toFixed(2)}`,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: "#737373" } },
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: "value",
      axisLabel: moneyAxisLabel,
      axisLine: { lineStyle: { color: "#737373" } },
      splitLine: { lineStyle: { color: "#404040" } },
    },
    series: [
      {
        type: "line",
        name: "User 累计盈亏",
        data: points.map((point) => point.user),
        smooth: true,
        symbol: "circle",
        lineStyle: { color: "#22c55e", width: 2 },
      },
      {
        type: "line",
        name: "Codex 累计盈亏",
        data: points.map((point) => point.codex),
        smooth: true,
        symbol: "circle",
        lineStyle: { color: "#fafafa", width: 2 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}

export function MarketBreakdownChart({ points }: { points: MarketChartPoint[] }) {
  const option = {
    backgroundColor: "transparent",
    grid: { left: 48, right: 16, top: 28, bottom: 40 },
    legend: {
      top: 0,
      textStyle: { color: "#a3a3a3" },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => `¥${value.toFixed(2)}`,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: "#737373" } },
      axisLabel: { interval: 0, rotate: points.length > 3 ? 20 : 0 },
    },
    yAxis: {
      type: "value",
      axisLabel: moneyAxisLabel,
      axisLine: { lineStyle: { color: "#737373" } },
      splitLine: { lineStyle: { color: "#404040" } },
    },
    series: [
      {
        type: "bar",
        name: "已结算盈亏",
        data: points.map((point) => point.profitLoss),
        itemStyle: { color: "#22c55e" },
      },
      {
        type: "bar",
        name: "未结算敞口",
        data: points.map((point) => point.openExposure),
        itemStyle: { color: "#a3a3a3" },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}
