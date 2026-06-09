"use client";

import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

type BalancePoint = {
  label: string;
  codex: number;
};

export function BalanceChart({ points }: { points: BalancePoint[] }) {
  const option = {
    backgroundColor: "transparent",
    grid: { left: 32, right: 16, top: 24, bottom: 24 },
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
        name: "Codex",
        data: points.map((point) => point.codex),
        smooth: true,
        lineStyle: { color: "#fafafa", width: 2 },
        areaStyle: { color: "rgba(250,250,250,0.08)" },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}
