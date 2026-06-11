import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                    <th className="py-2 pr-3 font-medium">Actor</th>
                    <th className="py-2 pr-3 font-medium">Settled</th>
                    <th className="py-2 pr-3 font-medium">Hit</th>
                    <th className="py-2 pr-3 font-medium">ROI</th>
                    <th className="py-2 pr-3 font-medium">P/L</th>
                    <th className="py-2 pr-3 font-medium">Avg odds</th>
                    <th className="py-2 pr-3 font-medium">Open risk</th>
                    <th className="py-2 font-medium">Drift</th>
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
            <div key={row.market} className="rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.market}</span>
                <span className="font-mono text-xs text-muted-foreground">{row.slipCount} slips</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>open {formatCny(row.openExposureCents)}</span>
                <span>settled stake {formatCny(row.settledStakeCents)}</span>
                <span>P/L {signedCny(row.profitLossCents)}</span>
              </div>
            </div>
          ))}
          {byMarket.length === 0 ? <p className="text-sm text-muted-foreground">暂无市场维度数据。</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
