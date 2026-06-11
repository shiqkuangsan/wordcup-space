import { desc, eq } from "drizzle-orm";
import { ListFilterForm } from "@/components/filters/list-filter-form";
import { IntentCard } from "@/components/intents/intent-card";
import { IntentForm } from "@/components/intents/intent-form";
import { getDb } from "@/db/client";
import { betIntentLegs, betIntents, matches, platformAccounts } from "@/db/schema";
import { formatLocalMinute } from "@/domain/dates";
import { formatBetModeLabel, formatDecisionByLabel, formatIntentStatus, formatRiskTierLabel } from "@/domain/display-labels";
import { countActiveFilters, getSearchParam, matchesText, type SearchParamsRecord } from "@/domain/list-filters";
import { formatMatchTitle } from "@/domain/team-names";

export const dynamic = "force-dynamic";

export default async function IntentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const params = await searchParams;
  const matchId = getSearchParam(params, "matchId");
  const status = getSearchParam(params, "status");
  const portfolioId = getSearchParam(params, "portfolioId");
  const decisionBy = getSearchParam(params, "decisionBy");
  const riskTier = getSearchParam(params, "riskTier");
  const mode = getSearchParam(params, "mode");
  const market = getSearchParam(params, "market");
  const q = getSearchParam(params, "q");
  const db = getDb();
  const allMatches = db.select().from(matches).orderBy(desc(matches.kickoffAt)).all();
  const allIntents = db.select().from(betIntents).orderBy(desc(betIntents.createdAt)).all();
  const allIntentLegs = db.select().from(betIntentLegs).all();
  const activePlatformAccounts = db.select().from(platformAccounts).where(eq(platformAccounts.isActive, true)).all();
  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const legsByIntent = new Map<string, typeof allIntentLegs>();

  for (const leg of allIntentLegs) {
    const existing = legsByIntent.get(leg.betIntentId) ?? [];
    existing.push(leg);
    legsByIntent.set(leg.betIntentId, existing);
  }

  const intents = allIntents.filter((intent) => {
    const legs = legsByIntent.get(intent.id) ?? [];
    if (matchId && !legs.some((leg) => leg.matchId === matchId)) return false;
    if (status && intent.status !== status) return false;
    if (portfolioId && intent.portfolioId !== portfolioId) return false;
    if (decisionBy && intent.decisionBy !== decisionBy) return false;
    if (riskTier && intent.riskTier !== riskTier) return false;
    if (mode && intent.mode !== mode) return false;
    if (market && !legs.some((leg) => leg.market === market)) return false;
    return matchesText(q, [
      intent.id,
      intent.market,
      intent.status,
      intent.rationale,
      intent.portfolioId,
      intent.decisionBy,
      intent.riskTier,
      intent.mode,
      ...legs.flatMap((leg) => {
        const match = leg.matchId ? matchesById.get(leg.matchId) : undefined;
        return [
          leg.matchId,
          leg.matchText,
          leg.market,
          leg.selection,
          leg.line,
          leg.notes,
          match?.homeTeam,
          match?.awayTeam,
          match ? formatMatchTitle(match.homeTeam, match.awayTeam) : undefined,
        ];
      }),
    ]);
  });
  const marketOptions = Array.from(new Set(allIntentLegs.map((leg) => leg.market))).sort().map((value) => ({
    value,
    label: value,
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
    riskTier,
    mode,
    market,
    q,
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-normal">决策队列</h2>
          <span className="text-sm text-muted-foreground">{intents.length} 条</span>
        </div>
        <ListFilterForm
          action="/intents"
          activeCount={activeFilterCount}
          fields={[
            { name: "q", label: "搜索", value: q, placeholder: "球队 / 选择 / 理由 / intent" },
            {
              name: "status",
              label: "状态",
              type: "select",
              value: status,
              options: ["draft", "proposed", "approved", "executed", "cancelled", "expired"].map((value) => ({
                value,
                label: formatIntentStatus(value),
              })),
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
              name: "riskTier",
              label: "风险",
              type: "select",
              value: riskTier,
              options: ["normal", "high_confidence", "parlay"].map((value) => ({
                value,
                label: formatRiskTierLabel(value),
              })),
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
        {intents.map((intent) => (
          <IntentCard
            key={intent.id}
            intent={intent}
            legs={allIntentLegs.filter((leg) => leg.betIntentId === intent.id)}
            platformAccounts={activePlatformAccounts}
          />
        ))}
        {intents.length === 0 ? <p className="text-sm text-muted-foreground">暂无 intent。</p> : null}
      </div>
      <IntentForm matches={allMatches} />
    </div>
  );
}
