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

export function BalanceChart({ points }: { points: BalancePoint[] }) {
  const option = {
    backgroundColor: "transparent",
    grid: { left: 32, right: 16, top: 24, bottom: 24 },
    legend: {
      top: 0,
      textStyle: { color: "#a3a3a3" },
    },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: "#737373" } },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#737373" } },
      splitLine: { lineStyle: { color: "#404040" } },
    },
    series: [
      {
        type: "line",
        name: "User",
        data: points.map((point) => point.user ?? null),
        smooth: true,
        connectNulls: true,
        symbol: "circle",
        lineStyle: { color: "#22c55e", width: 2 },
      },
      {
        type: "line",
        name: "Codex",
        data: points.map((point) => point.codex ?? null),
        smooth: true,
        connectNulls: true,
        symbol: "circle",
        lineStyle: { color: "#fafafa", width: 2 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}
