import { desc, eq } from "drizzle-orm";
import { ListFilterForm } from "@/components/filters/list-filter-form";
import { CodexReplayPanel } from "@/components/intents/codex-replay-panel";
import { IntentCard } from "@/components/intents/intent-card";
import { IntentForm } from "@/components/intents/intent-form";
import { QueueViewTabs } from "@/components/intents/queue-view-tabs";
import { getDb } from "@/db/client";
import { betIntentLegs, betIntents, betSlips, executionAttempts, matches, platformAccounts } from "@/db/schema";
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
type ExecutionAttemptRow = typeof executionAttempts.$inferSelect;

type QueueBucket = "needs_action" | "executed" | "closed_without_slip";
type IntentView = "pending" | "executed" | "missed" | "replay" | "all";

type IntentQueueItem = {
  intent: IntentRow;
  legs: Array<IntentLegRow & { matchHref?: string; matchTitle?: string }>;
  betSlipCount: number;
  attemptCount: number;
  failedAttemptCount: number;
  latestAttemptStatus?: string;
  effectiveStatus: string;
  bucket: QueueBucket;
  actionHint: string;
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
  attempts,
  now,
}: {
  intent: IntentRow;
  legs: IntentLegRow[];
  matchesById: Map<string, MatchRow>;
  betSlipCount: number;
  attempts: ExecutionAttemptRow[];
  now: Date;
}): IntentQueueItem {
  const effectiveStatus = getEffectiveIntentStatus(intent, now);
  const hasSlip = betSlipCount > 0 || intent.status === "executed";
  const stillNeedsDecision = !hasSlip && (isIntentExecutable(intent, now) || (effectiveStatus === "expired" && intent.status !== "cancelled" && intent.status !== "expired"));
  const failedAttemptCount = attempts.filter((attempt) => ["failed", "cancelled"].includes(attempt.status)).length;
  const latestAttempt = [...attempts].sort((a, b) => (getDateMs(b.createdAt) ?? 0) - (getDateMs(a.createdAt) ?? 0))[0];
  const bucket: QueueBucket = hasSlip ? "executed" : stillNeedsDecision ? "needs_action" : "closed_without_slip";
  const actionHint =
    bucket === "executed"
      ? "查看注单和后续结算"
      : bucket === "closed_without_slip"
        ? failedAttemptCount > 0
          ? "执行失败，保留原因用于复盘"
          : "未采纳或已关闭"
        : effectiveStatus === "expired"
          ? "已过窗口，需收口"
          : failedAttemptCount > 0
            ? "曾失败，可重试或取消"
            : "核对盘口后执行";

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
    attemptCount: attempts.length,
    failedAttemptCount,
    latestAttemptStatus: latestAttempt?.status,
    effectiveStatus,
    bucket,
    actionHint,
    expiresAtMs: getDateMs(intent.expiresAt),
    createdAtMs: getDateMs(intent.createdAt) ?? 0,
  };
}

function sortQueueItems(a: IntentQueueItem, b: IntentQueueItem) {
  if (a.bucket === "needs_action" && b.bucket === "needs_action") {
    if (a.effectiveStatus === "expired" && b.effectiveStatus !== "expired") return 1;
    if (a.effectiveStatus !== "expired" && b.effectiveStatus === "expired") return -1;
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
  if (["pending", "executed", "missed", "replay", "all"].includes(value)) {
    return value as IntentView;
  }
  if (["todo", "active", "expired"].includes(value)) return "pending";
  if (value === "archived") return "all";
  return "pending";
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
    { value: "pending", label: "待处理", description: "下单、重试、取消或重建" },
    { value: "executed", label: "已执行", description: "已生成注单" },
    { value: "missed", label: "未采纳/失败", description: "未成交的最终记录" },
    { value: "replay", label: "复盘", description: "Codex 理论 vs 实际" },
    { value: "all", label: "全部", description: "搜索和审计" },
  ];

  return (
    <QueueViewTabs
      activeView={activeView}
      tabs={tabs.map((tab) => ({
        ...tab,
        count: counts[tab.value],
        href: getTabHref(params, tab.value),
      }))}
    />
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
            attemptCount={item.attemptCount}
            failedAttemptCount={item.failedAttemptCount}
            actionHint={item.actionHint}
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
  const allExecutionAttempts = db.select().from(executionAttempts).all();
  const activePlatformAccounts = db.select().from(platformAccounts).where(eq(platformAccounts.isActive, true)).all();
  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const legsByIntent = new Map<string, typeof allIntentLegs>();
  const attemptsByIntent = new Map<string, typeof allExecutionAttempts>();
  const slipCountByIntent = new Map<string, number>();

  for (const leg of allIntentLegs) {
    const existing = legsByIntent.get(leg.betIntentId) ?? [];
    existing.push(leg);
    legsByIntent.set(leg.betIntentId, existing);
  }

  for (const slip of allBetSlips) {
    slipCountByIntent.set(slip.betIntentId, (slipCountByIntent.get(slip.betIntentId) ?? 0) + 1);
  }

  for (const attempt of allExecutionAttempts) {
    const existing = attemptsByIntent.get(attempt.betIntentId) ?? [];
    existing.push(attempt);
    attemptsByIntent.set(attempt.betIntentId, existing);
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
        attempts: attemptsByIntent.get(intent.id) ?? [],
        now,
      }),
    )
    .sort(sortQueueItems);
  const pendingItems = queueItems.filter((item) => item.bucket === "needs_action");
  const executedItems = queueItems.filter((item) => item.bucket === "executed");
  const missedItems = queueItems.filter((item) => item.bucket === "closed_without_slip");
  const summaryItems = allIntents.map((intent) =>
    buildQueueItem({
      intent,
      legs: legsByIntent.get(intent.id) ?? [],
      matchesById,
      betSlipCount: slipCountByIntent.get(intent.id) ?? 0,
      attempts: attemptsByIntent.get(intent.id) ?? [],
      now,
    }),
  );
  const totalPendingStakeCents = summaryItems
    .filter((item) => item.bucket === "needs_action")
    .reduce((sum, item) => sum + item.intent.intendedStakeCents, 0);
  const totalExecutedStakeCents = summaryItems
    .filter((item) => item.bucket === "executed")
    .reduce((sum, item) => sum + item.intent.intendedStakeCents, 0);
  const marketOptions = Array.from(new Set(allIntentLegs.map((leg) => leg.market))).sort().map((value) => ({
    value,
    label: formatMarketLabel(value),
  }));
  const riskTierOptions = Array.from(new Set([
    "normal",
    "small_test",
    "speculative",
    "longshot",
    "high_confidence",
    "parlay",
    "parlay_aggressive",
    ...allIntents.map((intent) => intent.riskTier),
  ])).map((value) => ({
    value,
    label: formatRiskTierLabel(value),
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
    pending: pendingItems.length,
    executed: executedItems.length,
    missed: missedItems.length,
    replay: codexReplay.rows.length,
    all: queueItems.length,
  };
  const viewConfig: Record<Exclude<IntentView, "replay">, {
    title: string;
    description: string;
    items: IntentQueueItem[];
    emptyText: string;
  }> = {
    pending: {
      title: "待处理",
      description: "这里不是历史列表，只放需要你下一步处理的 intent：核对盘口后执行、失败后重试或取消、过期后重建。",
      items: pendingItems,
      emptyText: "暂无需要处理的 intent。",
    },
    executed: {
      title: "已执行",
      description: "已经生成真实或模拟注单的 intent。后续主要去注单中心结算和复盘。",
      items: executedItems,
      emptyText: "暂无已执行 intent。",
    },
    missed: {
      title: "未采纳 / 失败",
      description: "没有生成注单的最终记录：你没有采纳、显式取消、执行失败或已关闭，用于后续复盘 Codex 建议质量。",
      items: missedItems,
      emptyText: "暂无未采纳或失败记录。",
    },
    all: {
      title: "全部决策",
      description: "审计和搜索入口。日常操作优先使用前面的动作 tab。",
      items: queueItems,
      emptyText: "暂无 intent。",
    },
  };
  const listView = view === "replay" ? viewConfig.pending : viewConfig[view];

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">决策队列</h2>
            <p className="text-sm text-muted-foreground">优先处理待执行、失败重试和过期收口。</p>
          </div>
          <div className="rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{queueItems.length}</span>
            {" / "}
            <span className="font-mono">{allIntents.length}</span>
            {" 条"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <QueueSummaryCell label="现在处理" value={summaryItems.filter((item) => item.bucket === "needs_action").length} detail={formatCny(totalPendingStakeCents)} />
          <QueueSummaryCell label="已成单" value={summaryItems.filter((item) => item.bucket === "executed").length} detail={formatCny(totalExecutedStakeCents)} />
          <QueueSummaryCell label="未成交" value={summaryItems.filter((item) => item.bucket === "closed_without_slip").length} detail="无扣款" />
          <QueueSummaryCell label="复盘样本" value={codexReplay.rows.length} detail={`${codexReplay.execution.placedCount}/${codexReplay.execution.notAdoptedCount}`} />
        </div>
        <QueueTabs activeView={view} params={params} counts={tabCounts} />
        {view === "replay" ? (
          <CodexReplayPanel replay={codexReplay} />
        ) : (
          <QueueSection
            title={listView.title}
            description={listView.description}
            items={listView.items}
            emptyText={listView.emptyText}
            now={now}
            platformAccounts={activePlatformAccounts}
          />
        )}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <details open={activeFilterCount > 0} className="group rounded-lg border bg-card p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
            <span>筛选 / 搜索</span>
            <span className="font-mono text-xs text-muted-foreground">{activeFilterCount}</span>
          </summary>
          <div className="mt-3">
            <ListFilterForm
              action="/intents"
              activeCount={activeFilterCount}
              layout="compact"
              fields={[
                { name: "view", label: "视图", type: "select", value: view, options: [
                  { value: "pending", label: "待处理" },
                  { value: "executed", label: "已执行" },
                  { value: "missed", label: "未采纳/失败" },
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
                  options: riskTierOptions,
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
          </div>
        </details>
        <details className="group rounded-lg border bg-card p-3">
          <summary className="cursor-pointer list-none text-sm font-medium">新建 intent</summary>
          <div className="mt-3">
            <IntentForm matches={allMatches} embedded />
          </div>
        </details>
      </aside>
    </div>
  );
}
