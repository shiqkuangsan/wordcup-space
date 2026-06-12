import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ListFilterForm } from "@/components/filters/list-filter-form";
import { CodexReplayPanel } from "@/components/intents/codex-replay-panel";
import { IntentCard } from "@/components/intents/intent-card";
import { IntentForm } from "@/components/intents/intent-form";
import { getDb } from "@/db/client";
import { betIntentLegs, betIntents, betSlips, matches, platformAccounts } from "@/db/schema";
import { getEffectiveIntentStatus, isIntentExecutable } from "@/domain/bet-lifecycle";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatLocalMinute } from "@/domain/dates";
import { formatBetModeLabel, formatDecisionByLabel, formatIntentStatus, formatRiskTierLabel } from "@/domain/display-labels";
import { countActiveFilters, getSearchParam, matchesText, type SearchParamsRecord } from "@/domain/list-filters";
import { formatCny } from "@/domain/money";
import { formatMatchTitle } from "@/domain/team-names";
import { getCodexReplaySummary } from "@/server/queries/codex-replay";

export const dynamic = "force-dynamic";

type IntentRow = typeof betIntents.$inferSelect;
type IntentLegRow = typeof betIntentLegs.$inferSelect;
type MatchRow = typeof matches.$inferSelect;
type PlatformAccountRow = typeof platformAccounts.$inferSelect;

type QueueBucket = "active" | "expired" | "archived";
type IntentView = "todo" | "replay" | "active" | "expired" | "archived" | "all";

type IntentQueueItem = {
  intent: IntentRow;
  legs: Array<IntentLegRow & { matchHref?: string; matchTitle?: string }>;
  betSlipCount: number;
  effectiveStatus: string;
  bucket: QueueBucket;
  expiresAtMs: number | null;
  createdAtMs: number;
};

function getDateMs(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function buildQueueItem({
  intent,
  legs,
  matchesById,
  betSlipCount,
  now,
}: {
  intent: IntentRow;
  legs: IntentLegRow[];
  matchesById: Map<string, MatchRow>;
  betSlipCount: number;
  now: Date;
}): IntentQueueItem {
  const effectiveStatus = getEffectiveIntentStatus(intent, now);
  const bucket: QueueBucket = isIntentExecutable(intent, now)
    ? "active"
    : effectiveStatus === "expired" && intent.status !== "executed" && intent.status !== "cancelled"
      ? "expired"
      : "archived";

  return {
    intent,
    legs: [...legs]
      .sort((a, b) => a.legOrder - b.legOrder)
      .map((leg) => {
        const match = leg.matchId ? matchesById.get(leg.matchId) : undefined;
        return {
          ...leg,
          matchHref: match ? `/matches/${match.id}` : undefined,
          matchTitle: match ? formatMatchTitle(match.homeTeam, match.awayTeam) : (leg.matchText ?? undefined),
        };
      }),
    betSlipCount,
    effectiveStatus,
    bucket,
    expiresAtMs: getDateMs(intent.expiresAt),
    createdAtMs: getDateMs(intent.createdAt) ?? 0,
  };
}

function sortQueueItems(a: IntentQueueItem, b: IntentQueueItem) {
  if (a.bucket === "active" && b.bucket === "active") {
    const aExpiry = a.expiresAtMs ?? Number.POSITIVE_INFINITY;
    const bExpiry = b.expiresAtMs ?? Number.POSITIVE_INFINITY;
    if (aExpiry !== bExpiry) return aExpiry - bExpiry;
  }
  return b.createdAtMs - a.createdAtMs;
}

function QueueSummaryCell({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function getIntentView(value: string): IntentView {
  if (["todo", "replay", "active", "expired", "archived", "all"].includes(value)) {
    return value as IntentView;
  }
  return "todo";
}

function getTabHref(params: SearchParamsRecord, view: IntentView) {
  const search = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    if (key === "view") continue;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value) search.set(key, value);
  }
  search.set("view", view);
  return `/intents?${search.toString()}`;
}

function QueueTabs({
  activeView,
  params,
  counts,
}: {
  activeView: IntentView;
  params: SearchParamsRecord;
  counts: Record<IntentView, number>;
}) {
  const tabs: Array<{ value: IntentView; label: string; description: string }> = [
    { value: "todo", label: "待办", description: "待执行 + 过期复核" },
    { value: "replay", label: "复盘对比", description: "理论 vs 实际" },
    { value: "active", label: "待执行", description: "仍在窗口内" },
    { value: "expired", label: "过期", description: "需取消或重建" },
    { value: "archived", label: "归档", description: "成交/取消历史" },
    { value: "all", label: "全部", description: "完整列表" },
  ];

  return (
    <nav aria-label="决策队列视图" className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      {tabs.map((tab) => {
        const active = activeView === tab.value;

        return (
          <Link
            key={tab.value}
            href={getTabHref(params, tab.value)}
            role="tab"
            aria-selected={active}
            className={[
              "rounded-md border px-3 py-2 text-sm transition-colors",
              active ? "border-foreground bg-foreground text-background" : "bg-background hover:border-foreground/40 hover:bg-muted/40",
            ].join(" ")}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{tab.label}</span>
              <span className={active ? "font-mono text-xs text-background/80" : "font-mono text-xs text-muted-foreground"}>{counts[tab.value]}</span>
            </span>
            <span className={active ? "mt-1 block text-xs text-background/75" : "mt-1 block text-xs text-muted-foreground"}>
              {tab.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function QueueSection({
  title,
  description,
  items,
  emptyText,
  now,
  platformAccounts,
}: {
  title: string;
  description: string;
  items: IntentQueueItem[];
  emptyText: string;
  now: Date;
  platformAccounts: PlatformAccountRow[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-sm text-muted-foreground">{items.length} 条</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <IntentCard
            key={item.intent.id}
            intent={item.intent}
            legs={item.legs}
            betSlipCount={item.betSlipCount}
            platformAccounts={platformAccounts}
            now={now}
          />
        ))}
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
      </div>
    </section>
  );
}

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
  const view = getIntentView(getSearchParam(params, "view"));
  const now = new Date();
  const codexReplay = getCodexReplaySummary(now);
  const db = getDb();
  const allMatches = db.select().from(matches).orderBy(desc(matches.kickoffAt)).all();
  const allIntents = db.select().from(betIntents).orderBy(desc(betIntents.createdAt)).all();
  const allIntentLegs = db.select().from(betIntentLegs).all();
  const allBetSlips = db.select().from(betSlips).all();
  const activePlatformAccounts = db.select().from(platformAccounts).where(eq(platformAccounts.isActive, true)).all();
  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const legsByIntent = new Map<string, typeof allIntentLegs>();
  const slipCountByIntent = new Map<string, number>();

  for (const leg of allIntentLegs) {
    const existing = legsByIntent.get(leg.betIntentId) ?? [];
    existing.push(leg);
    legsByIntent.set(leg.betIntentId, existing);
  }

  for (const slip of allBetSlips) {
    slipCountByIntent.set(slip.betIntentId, (slipCountByIntent.get(slip.betIntentId) ?? 0) + 1);
  }

  const filteredIntents = allIntents.filter((intent) => {
    const legs = legsByIntent.get(intent.id) ?? [];
    const effectiveStatus = getEffectiveIntentStatus(intent, now);
    if (matchId && !legs.some((leg) => leg.matchId === matchId)) return false;
    if (status && effectiveStatus !== status) return false;
    if (portfolioId && intent.portfolioId !== portfolioId) return false;
    if (decisionBy && intent.decisionBy !== decisionBy) return false;
    if (riskTier && intent.riskTier !== riskTier) return false;
    if (mode && intent.mode !== mode) return false;
    if (market && !legs.some((leg) => leg.market === market)) return false;
    return matchesText(q, [
      intent.id,
      intent.market,
      intent.status,
      effectiveStatus,
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
  const queueItems = filteredIntents
    .map((intent) =>
      buildQueueItem({
        intent,
        legs: legsByIntent.get(intent.id) ?? [],
        matchesById,
        betSlipCount: slipCountByIntent.get(intent.id) ?? 0,
        now,
      }),
    )
    .sort(sortQueueItems);
  const activeItems = queueItems.filter((item) => item.bucket === "active");
  const expiredItems = queueItems.filter((item) => item.bucket === "expired");
  const archivedItems = queueItems.filter((item) => item.bucket === "archived");
  const todoItems = [...activeItems, ...expiredItems];
  const summaryItems = allIntents.map((intent) =>
    buildQueueItem({
      intent,
      legs: legsByIntent.get(intent.id) ?? [],
      matchesById,
      betSlipCount: slipCountByIntent.get(intent.id) ?? 0,
      now,
    }),
  );
  const totalActiveStakeCents = summaryItems
    .filter((item) => item.bucket === "active")
    .reduce((sum, item) => sum + item.intent.intendedStakeCents, 0);
  const totalExecutedStakeCents = summaryItems
    .filter((item) => item.effectiveStatus === "executed")
    .reduce((sum, item) => sum + item.intent.intendedStakeCents, 0);
  const marketOptions = Array.from(new Set(allIntentLegs.map((leg) => leg.market))).sort().map((value) => ({
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
    riskTier,
    mode,
    market,
    q,
  });
  const tabCounts: Record<IntentView, number> = {
    todo: todoItems.length,
    replay: codexReplay.rows.length,
    active: activeItems.length,
    expired: expiredItems.length,
    archived: archivedItems.length,
    all: queueItems.length,
  };
  const viewConfig: Record<Exclude<IntentView, "replay">, {
    title: string;
    description: string;
    items: IntentQueueItem[];
    emptyText: string;
  }> = {
    todo: {
      title: "待办",
      description: "优先处理仍可执行的 intent；过期但未归档的 intent 放在后面复核。",
      items: todoItems,
      emptyText: "暂无待办 intent。",
    },
    active: {
      title: "待执行",
      description: "仍在执行窗口内，可以展开后预览执行或创建成交注单。",
      items: activeItems,
      emptyText: "暂无待执行 intent。",
    },
    expired: {
      title: "已过执行窗口",
      description: "状态字段可能还没归档，但不再允许直接执行。",
      items: expiredItems,
      emptyText: "暂无过期未归档 intent。",
    },
    archived: {
      title: "归档",
      description: "已成交、已取消或显式过期的历史决策。",
      items: archivedItems,
      emptyText: "暂无归档 intent。",
    },
    all: {
      title: "全部决策",
      description: "按当前筛选条件展示所有 intent。",
      items: queueItems,
      emptyText: "暂无 intent。",
    },
  };
  const listView = view === "replay" ? viewConfig.todo : viewConfig[view];

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">决策队列</h2>
            <p className="text-sm text-muted-foreground">按可执行性整理：先处理待执行，再复核过期，最后查看归档。</p>
          </div>
          <span className="text-sm text-muted-foreground">{queueItems.length} / {allIntents.length} 条</span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <QueueSummaryCell label="待处理" value={summaryItems.filter((item) => item.bucket === "active").length} detail={`stake ${formatCny(totalActiveStakeCents)}`} />
          <QueueSummaryCell label="已过窗口" value={summaryItems.filter((item) => item.bucket === "expired").length} detail="需取消或重建" />
          <QueueSummaryCell label="已成交" value={summaryItems.filter((item) => item.effectiveStatus === "executed").length} detail={`stake ${formatCny(totalExecutedStakeCents)}`} />
          <QueueSummaryCell label="已取消/过期" value={summaryItems.filter((item) => ["cancelled", "expired"].includes(item.effectiveStatus)).length} detail="归档记录" />
        </div>
        <QueueTabs activeView={view} params={params} counts={tabCounts} />
        {view === "replay" ? (
          <CodexReplayPanel replay={codexReplay} />
        ) : (
          <>
            <ListFilterForm
              action="/intents"
              activeCount={activeFilterCount}
              fields={[
                { name: "view", label: "视图", type: "select", value: view, options: [
                  { value: "todo", label: "待办" },
                  { value: "active", label: "待执行" },
                  { value: "expired", label: "过期" },
                  { value: "archived", label: "归档" },
                  { value: "all", label: "全部" },
                ] },
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
            <QueueSection
              title={listView.title}
              description={listView.description}
              items={listView.items}
              emptyText={listView.emptyText}
              now={now}
              platformAccounts={activePlatformAccounts}
            />
          </>
        )}
      </div>
      <IntentForm matches={allMatches} />
    </div>
  );
}
