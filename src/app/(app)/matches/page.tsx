import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, Radio, RefreshCw } from "lucide-react";
import { ListFilterForm } from "@/components/filters/list-filter-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchesAutoRefresh } from "@/components/matches/matches-auto-refresh";
import { OddsSourceMiniMatrix } from "@/components/matches/odds-source-table";
import { MatchSyncDrawer } from "@/components/matches/sync-drawer";
import { Separator } from "@/components/ui/separator";
import { getDb } from "@/db/client";
import { oddsSnapshots } from "@/db/schema";
import { formatLocalDateLabel, formatLocalMinute, formatLocalTime, localDateKey } from "@/domain/dates";
import { countActiveFilters, getSearchParam, matchesDateRange, matchesText, type SearchParamsRecord } from "@/domain/list-filters";
import { formatMatchStage, formatMatchStatus, MATCH_STAGE_OPTIONS, MATCH_STATUS_OPTIONS } from "@/domain/match-sync";
import { formatTeamName, getTeamFlag } from "@/domain/team-names";
import { listMatches } from "@/server/queries/matches";
import { ensureWorldCup2026ApiMatchesFresh } from "@/server/actions/worldcup2026-api-sync";
import { WORLDCUP2026_API_SOURCE_NAME } from "@/server/providers/worldcup2026-api";

export const dynamic = "force-dynamic";

const MATCHES_AUTO_REFRESH_MS = 60_000;

type Match = Awaited<ReturnType<typeof listMatches>>[number];
type OddsSnapshot = typeof oddsSnapshots.$inferSelect;

function groupMatchesByDate(matches: Match[]) {
  const groups = new Map<string, Match[]>();

  for (const match of matches) {
    const key = localDateKey(match.kickoffAt);
    const existing = groups.get(key) ?? [];
    existing.push(match);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([dateKey, dateMatches]) => ({
    dateKey,
    label: formatLocalDateLabel(dateMatches[0]?.kickoffAt ?? dateKey),
    matches: dateMatches,
  }));
}

function TeamName({ name }: { name: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="text-base leading-none" aria-hidden="true">
        {getTeamFlag(name)}
      </span>
      <span className="truncate">{formatTeamName(name)}</span>
    </span>
  );
}

function getLatestOddsGroups(odds: OddsSnapshot[]) {
  const latestByBookmaker = new Map<string, OddsSnapshot[]>();

  for (const snapshot of odds) {
    const key = `${snapshot.bookmaker}:${snapshot.market}`;
    const existing = latestByBookmaker.get(key);
    if (!existing) {
      latestByBookmaker.set(key, [snapshot]);
      continue;
    }
    if (snapshot.capturedAt === existing[0].capturedAt) {
      existing.push(snapshot);
    }
  }

  return Array.from(latestByBookmaker.values());
}

function MatchDateGroup({
  group,
  oddsByMatch,
}: {
  group: ReturnType<typeof groupMatchesByDate>[number];
  oddsByMatch: Map<string, OddsSnapshot[][]>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold tracking-normal">{group.label}</h3>
          <p className="text-sm text-muted-foreground">{group.matches.length} 场比赛</p>
        </div>
        <Badge variant="secondary">{group.dateKey}</Badge>
      </div>
      <div className="divide-y rounded-md border">
        {group.matches.map((match) => (
          <Link
            key={match.id}
            href={`/matches/${match.id}`}
            className="grid gap-3 px-3 py-3 transition-colors hover:bg-muted/50 md:grid-cols-[72px_1fr_auto]"
          >
            <div className="font-mono text-sm tabular-nums text-muted-foreground">
              {formatLocalTime(match.kickoffAt)}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="grid min-w-0 grid-cols-[74px_minmax(58px,1fr)_48px_minmax(58px,1fr)] items-center gap-2 sm:grid-cols-[84px_minmax(80px,1fr)_56px_minmax(80px,1fr)]">
                <div className="text-[11px] text-muted-foreground">平台</div>
                <div className="flex min-w-0 items-center gap-1 font-medium">
                  <span className="font-mono text-[11px] text-muted-foreground">1</span>
                  <TeamName name={match.homeTeam} />
                </div>
                <span className="text-center text-xs uppercase text-muted-foreground">
                  <span className="font-mono">X</span> vs
                </span>
                <div className="flex min-w-0 items-center justify-end gap-1 font-medium">
                  <span className="font-mono text-[11px] text-muted-foreground">2</span>
                  <TeamName name={match.awayTeam} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatMatchStage(match.stage)}</span>
                {match.groupName ? (
                  <>
                    <Separator orientation="vertical" className="h-3" />
                    <span>{match.groupName} 组</span>
                  </>
                ) : null}
                {match.venue ? (
                  <>
                    <Separator orientation="vertical" className="h-3" />
                    <span>{match.venue}</span>
                  </>
                ) : null}
              </div>
              {(oddsByMatch.get(match.id) ?? []).length ? (
                <OddsSourceMiniMatrix
                  groups={oddsByMatch.get(match.id) ?? []}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                />
              ) : null}
            </div>
            <div className="flex items-center md:justify-end">
              <Badge variant="outline">{formatMatchStatus(match.status)}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MatchStatusSection({
  title,
  emptyText,
  groups,
  oddsByMatch,
  icon,
}: {
  title: string;
  emptyText: string;
  groups: ReturnType<typeof groupMatchesByDate>;
  oddsByMatch: Map<string, OddsSnapshot[][]>;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group) => (
          <MatchDateGroup key={group.dateKey} group={group} oddsByMatch={oddsByMatch} />
        ))}
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
      </CardContent>
    </Card>
  );
}

function summarizeSources(matches: Match[]) {
  const summaries = new Map<string, { sourceName: string; count: number; lastSyncedAt?: string | null }>();

  for (const match of matches) {
    const sourceName = match.dataSource ?? "unknown";
    const summary = summaries.get(sourceName) ?? { sourceName, count: 0, lastSyncedAt: null };
    summary.count += 1;
    if (match.lastSyncedAt && (!summary.lastSyncedAt || match.lastSyncedAt > summary.lastSyncedAt)) {
      summary.lastSyncedAt = match.lastSyncedAt;
    }
    summaries.set(sourceName, summary);
  }

  return Array.from(summaries.values()).sort((a, b) => b.count - a.count);
}

function SourceFilter({
  summaries,
  activeSource,
}: {
  summaries: ReturnType<typeof summarizeSources>;
  activeSource: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/matches" className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted">
        自动
      </Link>
      <Link
        href="/matches?source=all"
        className={`rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted ${
          activeSource === "all" ? "bg-muted" : ""
        }`}
      >
        全部
      </Link>
      {summaries.map((summary) => (
        <Link
          key={summary.sourceName}
          href={`/matches?source=${encodeURIComponent(summary.sourceName)}`}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted ${
            activeSource === summary.sourceName ? "bg-muted" : ""
          }`}
        >
          {summary.sourceName} · {summary.count}
        </Link>
      ))}
    </div>
  );
}

export default async function MatchesPage({ searchParams }: { searchParams?: Promise<SearchParamsRecord> }) {
  const syncStatus = await ensureWorldCup2026ApiMatchesFresh(MATCHES_AUTO_REFRESH_MS);
  const allMatches = await listMatches();
  const allOdds = getDb().select().from(oddsSnapshots).all().sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const oddsRowsByMatch = new Map<string, OddsSnapshot[]>();
  for (const row of allOdds) {
    const existing = oddsRowsByMatch.get(row.matchId) ?? [];
    existing.push(row);
    oddsRowsByMatch.set(row.matchId, existing);
  }
  const oddsByMatch = new Map(
    Array.from(oddsRowsByMatch.entries()).map(([matchId, odds]) => [matchId, getLatestOddsGroups(odds)]),
  );
  const sourceSummaries = summarizeSources(allMatches);
  const hasWorldCup2026Api = sourceSummaries.some((summary) => summary.sourceName === WORLDCUP2026_API_SOURCE_NAME);
  const params = await searchParams;
  const requestedSource = getSearchParam(params, "source");
  const status = getSearchParam(params, "status");
  const stage = getSearchParam(params, "stage");
  const group = getSearchParam(params, "group");
  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const q = getSearchParam(params, "q");
  const activeSource = requestedSource || (hasWorldCup2026Api ? WORLDCUP2026_API_SOURCE_NAME : "all");
  const matches =
    activeSource === "all"
      ? allMatches
      : allMatches.filter((match) => (match.dataSource ?? "unknown") === activeSource);
  const filteredMatches = matches.filter((match) => {
    if (status && match.status !== status) return false;
    if (stage && match.stage !== stage) return false;
    if (group && match.groupName !== group) return false;
    if (!matchesDateRange(match.kickoffAt, dateFrom, dateTo)) return false;
    return matchesText(q, [
      match.id,
      match.externalId,
      match.matchNumber,
      match.homeTeam,
      formatTeamName(match.homeTeam),
      match.awayTeam,
      formatTeamName(match.awayTeam),
      match.venue,
      match.groupName,
      match.stage,
      match.status,
    ]);
  });
  const liveMatches = filteredMatches.filter((match) => match.status === "live");
  const scheduledMatches = filteredMatches.filter((match) => match.status === "scheduled");
  const finishedMatches = filteredMatches.filter((match) => match.status === "finished");
  const exceptionalMatches = filteredMatches.filter((match) => ["postponed", "cancelled"].includes(match.status));
  const liveGroups = groupMatchesByDate(liveMatches);
  const scheduledGroups = groupMatchesByDate(scheduledMatches);
  const finishedGroups = groupMatchesByDate(finishedMatches).slice().reverse();
  const exceptionalGroups = groupMatchesByDate(exceptionalMatches);
  const activeSummary = sourceSummaries.find((summary) => summary.sourceName === activeSource);
  const lastSyncedAt = activeSummary?.lastSyncedAt;
  const groupOptions = Array.from(new Set(allMatches.map((match) => match.groupName).filter(Boolean)))
    .sort()
    .map((value) => ({ value: value!, label: `${value} 组` }));
  const activeFilterCount = countActiveFilters({
    source: requestedSource,
    status,
    stage,
    group,
    dateFrom,
    dateTo,
    q,
  });

  return (
    <div className="space-y-6">
      <div className="sticky top-[-16px] z-30 -mx-4 -mt-4 space-y-2 border-b bg-background px-4 pt-4 pb-3 shadow-sm md:top-[-24px] md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-muted-foreground">2026 World Cup</p>
            <h2 className="text-2xl font-semibold tracking-normal">比赛中心</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{filteredMatches.length} 场</Badge>
            <Badge variant="outline">比赛中 {liveMatches.length}</Badge>
            <Badge variant="outline">未开赛 {scheduledMatches.length}</Badge>
            <Badge variant="outline">已完结 {finishedMatches.length}</Badge>
            <Badge variant="outline">最近同步 {lastSyncedAt ? formatLocalMinute(lastSyncedAt) : "暂无"}</Badge>
            <MatchesAutoRefresh intervalMs={MATCHES_AUTO_REFRESH_MS} />
            <MatchSyncDrawer summaries={sourceSummaries} visibleSource={activeSource} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4" />
          <span>
            {syncStatus.ok
              ? syncStatus.attempted
                ? "已自动同步公开赛程"
                : "本地赛程仍在新鲜期"
              : "自动同步失败，正在显示本地缓存"}
          </span>
        </div>
      </div>

      <ListFilterForm
        action="/matches"
        activeCount={activeFilterCount}
        fields={[
          {
            name: "source",
            label: "数据源",
            type: "select",
            value: requestedSource,
            options: [
              { value: "all", label: "全部来源" },
              ...sourceSummaries.map((summary) => ({
                value: summary.sourceName,
                label: `${summary.sourceName} · ${summary.count}`,
              })),
            ],
          },
          {
            name: "status",
            label: "状态",
            type: "select",
            value: status,
            options: MATCH_STATUS_OPTIONS,
          },
          {
            name: "stage",
            label: "阶段",
            type: "select",
            value: stage,
            options: MATCH_STAGE_OPTIONS,
          },
          {
            name: "group",
            label: "小组",
            type: "select",
            value: group,
            options: groupOptions,
          },
          { name: "dateFrom", label: "开始日期", type: "date", value: dateFrom },
          { name: "dateTo", label: "结束日期", type: "date", value: dateTo },
          { name: "q", label: "搜索", value: q, placeholder: "球队 / 场馆 / 编号" },
        ]}
      />

      <SourceFilter summaries={sourceSummaries} activeSource={activeSource} />

      {!syncStatus.ok ? (
        <Alert variant="destructive">
          <AlertTitle>赛程同步失败</AlertTitle>
          <AlertDescription>{syncStatus.error}</AlertDescription>
        </Alert>
      ) : null}

      <MatchStatusSection
        title="比赛中"
        emptyText="暂无比赛中。"
        groups={liveGroups}
        oddsByMatch={oddsByMatch}
        icon={<Radio className="size-5" />}
      />

      <MatchStatusSection
        title="未开赛"
        emptyText="暂无未开赛比赛。"
        groups={scheduledGroups}
        oddsByMatch={oddsByMatch}
        icon={<CalendarDays className="size-5" />}
      />

      <MatchStatusSection
        title="已完结"
        emptyText="暂无已完结比赛。"
        groups={finishedGroups}
        oddsByMatch={oddsByMatch}
        icon={<CheckCircle2 className="size-5" />}
      />

      {exceptionalGroups.length > 0 ? (
        <MatchStatusSection
          title="延期 / 取消"
          emptyText="暂无延期或取消比赛。"
          groups={exceptionalGroups}
          oddsByMatch={oddsByMatch}
          icon={<CalendarDays className="size-5" />}
        />
      ) : null}
    </div>
  );
}
