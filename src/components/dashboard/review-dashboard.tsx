import Link from "next/link";
import { ProfitLossChart } from "@/components/charts/performance-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatDecisionByLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import type { ReviewSummary } from "@/domain/review-metrics";

type MarketBreakdown = {
  market: string;
  slipCount: number;
  openExposureCents: number;
  settledStakeCents: number;
  profitLossCents: number;
};

type ProfitLossPoint = {
  label: string;
  user: number;
  codex: number;
};

type ExecutionQuality = {
  decisionBy: string;
  attemptCount: number;
  successCount: number;
  failedCount: number;
  toleranceBreachCount: number;
  averageOddsChangePct: number | null;
};

function pct(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function signedCny(cents: number) {
  const sign = cents > 0 ? "+" : "";
  return `${sign}${formatCny(cents)}`;
}

export function ReviewDashboard({
  profitLossTimeline,
  executionQuality,
  byDecision,
  byMarket,
}: {
  profitLossTimeline: ProfitLossPoint[];
  executionQuality: ExecutionQuality[];
  byDecision: ReviewSummary[];
  byMarket: MarketBreakdown[];
}) {
  const totalOpenExposureCents = byMarket.reduce((sum, row) => sum + row.openExposureCents, 0);
  const totalProfitLossCents = byMarket.reduce((sum, row) => sum + row.profitLossCents, 0);
  const topOpenRisk = byMarket
    .slice()
    .sort((a, b) => b.openExposureCents - a.openExposureCents)
    .find((row) => row.openExposureCents > 0);
  const losingMarkets = byMarket.filter((row) => row.profitLossCents < 0).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>累计盈亏</CardTitle>
          </CardHeader>
          <CardContent>
            {profitLossTimeline.length ? (
              <ProfitLossChart points={profitLossTimeline} />
            ) : (
              <p className="text-sm text-muted-foreground">暂无已结算注单，结算后会显示 User / Codex 累计盈亏。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前风险重点</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byMarket.length ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border px-3 py-2">
                    <div className="text-xs text-muted-foreground">未结算敞口</div>
                    <div className="mt-1 font-mono text-2xl font-semibold">{formatCny(totalOpenExposureCents)}</div>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <div className="text-xs text-muted-foreground">已结算盈亏</div>
                    <div className="mt-1 font-mono text-2xl font-semibold">{signedCny(totalProfitLossCents)}</div>
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b pb-2">
                    <span className="text-muted-foreground">最大未结算市场</span>
                    <span className="text-right font-medium">
                      {topOpenRisk ? `${formatMarketLabel(topOpenRisk.market)} · ${formatCny(topOpenRisk.openExposureCents)}` : "暂无"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b pb-2">
                    <span className="text-muted-foreground">亏损市场数</span>
                    <span className="font-mono">{losingMarkets}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">市场数量</span>
                    <span className="font-mono">{byMarket.length}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">暂无市场维度数据。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>决策表现</CardTitle>
          </CardHeader>
          <CardContent>
            {byDecision.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 font-medium">决策来源</th>
                      <th className="py-2 pr-3 font-medium">已结算</th>
                      <th className="py-2 pr-3 font-medium">命中率</th>
                      <th className="py-2 pr-3 font-medium">ROI</th>
                      <th className="py-2 pr-3 font-medium">盈亏</th>
                      <th className="py-2 font-medium">未结算敞口</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDecision.map((row) => (
                      <tr key={row.decisionBy} className="border-t">
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{formatDecisionByLabel(row.decisionBy)}</Badge>
                        </td>
                        <td className="py-2 pr-3 font-mono">{row.settledCount}</td>
                        <td className="py-2 pr-3 font-mono">{pct(row.hitRate)}</td>
                        <td className="py-2 pr-3 font-mono">{pct(row.roi)}</td>
                        <td className="py-2 pr-3 font-mono">{signedCny(row.profitLossCents)}</td>
                        <td className="py-2 font-mono">{formatCny(row.openExposureCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无已成交注单，复盘指标会在第一张 slip 后出现。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>执行质量</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {executionQuality.length ? (
              executionQuality.map((row) => (
                <div key={row.decisionBy} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{formatDecisionByLabel(row.decisionBy)}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{row.attemptCount} 次尝试</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>成功率 {pct(row.attemptCount ? row.successCount / row.attemptCount : null)}</span>
                    <span>失败 {row.failedCount} 次</span>
                    <span>平均赔率偏移 {pct(row.averageOddsChangePct)}</span>
                    <span>超容忍 {row.toleranceBreachCount} 次</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂无执行尝试数据。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>市场风险</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {byMarket.slice(0, 6).map((row) => (
            <Link
              key={row.market}
              href={`/bets?market=${encodeURIComponent(row.market)}`}
              className="block rounded-md border px-3 py-2 text-sm transition-colors hover:border-foreground/40 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{formatMarketLabel(row.market)}</span>
                <span className="font-mono text-xs text-muted-foreground">{row.slipCount} 张注单</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>未结算 {formatCny(row.openExposureCents)}</span>
                <span>已结算本金 {formatCny(row.settledStakeCents)}</span>
                <span>盈亏 {signedCny(row.profitLossCents)}</span>
              </div>
            </Link>
          ))}
          {byMarket.length === 0 ? <p className="text-sm text-muted-foreground">暂无市场维度数据。</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
