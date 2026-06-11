import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecisionByLabel } from "@/domain/display-labels";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatCny } from "@/domain/money";
import type { ReviewSummary } from "@/domain/review-metrics";

type MarketBreakdown = {
  market: string;
  slipCount: number;
  openExposureCents: number;
  settledStakeCents: number;
  profitLossCents: number;
};

function pct(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function signedCny(cents: number) {
  const sign = cents > 0 ? "+" : "";
  return `${sign}${formatCny(cents)}`;
}

export function ReviewDashboard({
  byDecision,
  byMarket,
}: {
  byDecision: ReviewSummary[];
  byMarket: MarketBreakdown[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>复盘表现</CardTitle>
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
                    <th className="py-2 pr-3 font-medium">平均赔率</th>
                    <th className="py-2 pr-3 font-medium">未结算敞口</th>
                    <th className="py-2 font-medium">赔率偏移</th>
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
                      <td className="py-2 pr-3 font-mono">{row.averageOdds === null ? "-" : row.averageOdds.toFixed(2)}</td>
                      <td className="py-2 pr-3 font-mono">{formatCny(row.openExposureCents)}</td>
                      <td className="py-2 font-mono">{pct(row.averageOddsChangePct)}</td>
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
          <CardTitle>市场风险</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
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
