import { desc } from "drizzle-orm";
import { BetsTable } from "@/components/bets/bets-table";
import { ListFilterForm } from "@/components/filters/list-filter-form";
import { QuickRecordPanel } from "@/components/bets/quick-record-panel";
import { ReviewEntryPanel } from "@/components/bets/review-entry-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { betIntents, betSlipLegs, decisionReviews, matches, platformAccounts } from "@/db/schema";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatLocalMinute } from "@/domain/dates";
import { formatBetModeLabel, formatBetSlipStatus, formatDecisionByLabel } from "@/domain/display-labels";
import { countActiveFilters, getSearchParam, type SearchParamsRecord } from "@/domain/list-filters";
import { formatMatchTitle } from "@/domain/team-names";
import { listBetSlips } from "@/server/queries/bets";

export const dynamic = "force-dynamic";

export default async function BetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const params = await searchParams;
  const matchId = getSearchParam(params, "matchId");
  const status = getSearchParam(params, "status");
  const portfolioId = getSearchParam(params, "portfolioId");
  const decisionBy = getSearchParam(params, "decisionBy");
  const isRealMoney = getSearchParam(params, "isRealMoney");
  const mode = getSearchParam(params, "mode");
  const market = getSearchParam(params, "market");
  const q = getSearchParam(params, "q");
  const db = getDb();
  const slips = await listBetSlips({ matchId, status, portfolioId, decisionBy, isRealMoney, mode, market, q });
  const openSlips = slips.filter((slip) => slip.status === "open");
  const settledSlips = slips.filter((slip) => slip.status !== "open");
  const intents = db.select().from(betIntents).orderBy(desc(betIntents.createdAt)).all();
  const executableIntents = intents.filter((intent) => !["executed", "cancelled", "expired"].includes(intent.status));
  const accounts = db.select().from(platformAccounts).orderBy(desc(platformAccounts.createdAt)).all();
  const allMatches = db.select().from(matches).orderBy(desc(matches.kickoffAt)).all();
  const allSlipLegs = db.select().from(betSlipLegs).all();
  const reviews = db.select().from(decisionReviews).orderBy(desc(decisionReviews.createdAt)).all();
  const marketOptions = Array.from(new Set(allSlipLegs.map((leg) => leg.market))).sort().map((value) => ({
    value,
    label: formatMarketLabel(value),
  }));
  const matchOptions = allMatches.map((match) => ({
    value: match.id,
    label: `${formatLocalMinute(match.kickoffAt)} · ${formatMatchTitle(match.homeTeam, match.awayTeam)}`,
  }));
  const activeFilterCount = countActiveFilters({
    matchId,
    status,
    portfolioId,
    decisionBy,
    isRealMoney,
    mode,
    market,
    q,
  });

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <ListFilterForm
          action="/bets"
          activeCount={activeFilterCount}
          fields={[
            { name: "q", label: "搜索", value: q, placeholder: "球队 / 选择 / 确认号 / slip" },
            {
              name: "status",
              label: "状态",
              type: "select",
              value: status,
              options: [
                { value: "open", label: formatBetSlipStatus("open") },
                { value: "settled", label: "全部已结算" },
                { value: "won", label: formatBetSlipStatus("won") },
                { value: "lost", label: formatBetSlipStatus("lost") },
                { value: "void", label: formatBetSlipStatus("void") },
                { value: "half_won", label: formatBetSlipStatus("half_won") },
                { value: "half_lost", label: formatBetSlipStatus("half_lost") },
                { value: "cashout", label: formatBetSlipStatus("cashout") },
                { value: "cancelled", label: formatBetSlipStatus("cancelled") },
              ],
            },
            {
              name: "portfolioId",
              label: "账本",
              type: "select",
              value: portfolioId,
              options: [
                { value: "user", label: "User" },
                { value: "codex", label: "Codex" },
              ],
            },
            {
              name: "decisionBy",
              label: "决策",
              type: "select",
              value: decisionBy,
              options: [
                { value: "user", label: formatDecisionByLabel("user") },
                { value: "codex", label: formatDecisionByLabel("codex") },
              ],
            },
            {
              name: "isRealMoney",
              label: "真实资金",
              type: "select",
              value: isRealMoney,
              options: [
                { value: "true", label: "是" },
                { value: "false", label: "否" },
              ],
            },
            {
              name: "mode",
              label: "组合",
              type: "select",
              value: mode,
              options: [
                { value: "single", label: formatBetModeLabel("single") },
                { value: "parlay", label: formatBetModeLabel("parlay") },
              ],
            },
            { name: "market", label: "市场", type: "select", value: market, options: marketOptions },
            { name: "matchId", label: "比赛", type: "select", value: matchId, options: matchOptions },
          ]}
        />
        <Card>
          <CardHeader><CardTitle>未结算注单 · {openSlips.length}</CardTitle></CardHeader>
          <CardContent><BetsTable slips={openSlips} emptyText="暂无未结算注单。" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>已结算注单 · {settledSlips.length}</CardTitle></CardHeader>
          <CardContent><BetsTable slips={settledSlips} emptyText="暂无已结算注单。" /></CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <QuickRecordPanel
          executableIntents={executableIntents}
          openSlips={openSlips}
          platformAccounts={accounts}
          matches={allMatches}
        />
        <ReviewEntryPanel settledSlips={settledSlips} reviews={reviews} />
      </div>
    </div>
  );
}
