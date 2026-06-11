import { BalanceChart } from "@/components/charts/balance-chart";
import { DailyCommandCenter } from "@/components/dashboard/daily-command-center";
import { OpenRiskTable } from "@/components/dashboard/open-risk-table";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { RecentBetsTable } from "@/components/dashboard/recent-bets-table";
import { ReviewDashboard } from "@/components/dashboard/review-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCny } from "@/domain/money";
import { getDashboardSummary } from "@/server/queries/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const user = summary.portfolios.find((portfolio) => portfolio.id === "user");
  const codex = summary.portfolios.find((portfolio) => portfolio.id === "codex");
  const openExposure = summary.openBetSlips.reduce((sum, slip) => sum + slip.stakeCents, 0);
  const balancePoints = summary.recentLedgerEntries
    .filter((entry) => entry.portfolioId === "codex")
    .reverse()
    .map((entry) => ({
      label: entry.createdAt.slice(0, 10),
      codex: entry.balanceAfterCents / 100,
    }));

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">Phase 1 MVP</p>
        <h2 className="text-2xl font-semibold tracking-normal">总览 Dashboard</h2>
      </div>
      <DailyCommandCenter
        dateKey={summary.commandCenter.dateKey}
        focusLabel={summary.commandCenter.focusLabel}
        focusMatches={summary.commandCenter.focusMatches}
        missingOdds={summary.commandCenter.missingOdds}
        pendingIntents={summary.commandCenter.pendingIntents}
        settlementQueue={summary.commandCenter.settlementQueue}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <PortfolioSummary title="User 余额" balanceCents={user?.allocatedBalanceCents ?? 0} subtitle="你的逻辑账本" />
        <PortfolioSummary title="Codex 余额" balanceCents={codex?.allocatedBalanceCents ?? 0} subtitle="Codex 独立预算池" />
        <PortfolioSummary title="未结算敞口" balanceCents={openExposure} subtitle="已成交未结算 stake" />
        <PortfolioSummary title="待执行意图" balanceCents={summary.pendingIntents.length * 100} subtitle="数量以 1.00 表示一条" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Codex 余额曲线</CardTitle>
        </CardHeader>
        <CardContent>
          {balancePoints.length ? (
            <BalanceChart points={balancePoints} />
          ) : (
            <p className="text-sm text-muted-foreground">暂无资金流水数据。</p>
          )}
        </CardContent>
      </Card>
      <ReviewDashboard byDecision={summary.review.byDecision} byMarket={summary.review.byMarket} />
      <div className="grid gap-4 xl:grid-cols-2">
        <OpenRiskTable slips={summary.openBetSlips} />
        <RecentBetsTable slips={summary.recentBetSlips} />
      </div>
      <p className="text-sm text-muted-foreground">
        当前 Codex 可用余额：{formatCny(codex?.allocatedBalanceCents ?? 0)}
      </p>
    </div>
  );
}
