import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CodexAnalysisPanel } from "@/components/matches/codex-analysis-panel";
import { MatchResultForm } from "@/components/matches/match-result-form";
import { OddsEntryForm } from "@/components/matches/odds-entry-form";
import { getDb } from "@/db/client";
import {
  betIntentLegs,
  betIntents,
  betSlipLegs,
  betSlips,
  executionAttempts,
  matches,
  matchResults,
  oddsSnapshots,
  settlements,
} from "@/db/schema";
import { formatLocalMinute } from "@/domain/dates";
import { formatMatchStage, formatMatchStatus } from "@/domain/match-sync";
import { getMatchWorkflowStatus } from "@/domain/match-workflow";
import { formatCny } from "@/domain/money";
import { analyzeOddsSnapshot, devigMarketProbabilities } from "@/domain/odds-analysis";
import { formatMatchTitle } from "@/domain/team-names";

export const dynamic = "force-dynamic";

type OddsSnapshot = typeof oddsSnapshots.$inferSelect;

function getLatestOddsGroup(odds: OddsSnapshot[]) {
  const latestOdds = odds[0];
  if (!latestOdds) return [];

  return odds.filter(
    (snapshot) =>
      snapshot.bookmaker === latestOdds.bookmaker &&
      snapshot.market === latestOdds.market &&
      snapshot.capturedAt === latestOdds.capturedAt,
  );
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const match = db.select().from(matches).where(eq(matches.id, id)).get();
  const odds = db
    .select()
    .from(oddsSnapshots)
    .where(eq(oddsSnapshots.matchId, id))
    .orderBy(desc(oddsSnapshots.capturedAt))
    .all();
  const intentLegs = db.select().from(betIntentLegs).where(eq(betIntentLegs.matchId, id)).all();
  const slipLegs = db.select().from(betSlipLegs).where(eq(betSlipLegs.matchId, id)).all();
  const resultRows = db
    .select()
    .from(matchResults)
    .where(eq(matchResults.matchId, id))
    .orderBy(desc(matchResults.createdAt))
    .all();
  const intentIds = new Set(intentLegs.map((leg) => leg.betIntentId));
  const slipIds = new Set(slipLegs.map((leg) => leg.betSlipId));
  const intents = db.select().from(betIntents).all().filter((intent) => intentIds.has(intent.id));
  const attempts = db.select().from(executionAttempts).all().filter((attempt) => intentIds.has(attempt.betIntentId));
  const slips = db.select().from(betSlips).all().filter((slip) => slipIds.has(slip.id));
  const settlementRows = db.select().from(settlements).all().filter((settlement) => slipIds.has(settlement.betSlipId));

  if (!match) return <div>比赛不存在。</div>;

  const openSlips = slips.filter((slip) => slip.status === "open");
  const latestResult = resultRows[0];
  const hasSettlementCandidates = openSlips.length > 0 && (match.status === "finished" || latestResult?.resultStatus === "finished");
  const workflow = getMatchWorkflowStatus({
    matchStatus: match.status,
    oddsCount: odds.length,
    intentCount: intents.length,
    slipCount: slips.length,
    openSlipCount: openSlips.length,
  });
  const latestOdds = odds[0];
  const latestMarketOdds = getLatestOddsGroup(odds);
  const latestMarketAnalysis =
    latestMarketOdds.length >= 2
      ? devigMarketProbabilities(
          latestMarketOdds
            .slice()
            .reverse()
            .map((snapshot) => ({ id: snapshot.selection, decimalOdds: snapshot.decimalOdds })),
        )
      : null;
  const oddsOptions = odds.map((snapshot) => ({
    id: snapshot.id,
    bookmaker: snapshot.bookmaker,
    market: snapshot.market,
    selection: snapshot.selection,
    line: snapshot.line,
    decimalOdds: snapshot.decimalOdds,
    capturedAt: snapshot.capturedAt,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{formatMatchStage(match.stage)}</p>
            <h2 className="text-2xl font-semibold tracking-normal">
              {formatMatchTitle(match.homeTeam, match.awayTeam)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatLocalMinute(match.kickoffAt)}
              {match.venue ? ` · ${match.venue}` : ""}
              {match.groupName ? ` · ${match.groupName} 组` : ""}
              {` · ${formatMatchStatus(match.status)}`}
            </p>
          </div>
          <Badge variant="outline">{workflow.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>来源 {match.dataSource ?? "unknown"}</span>
          {match.matchNumber ? (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span>Match {match.matchNumber}</span>
            </>
          ) : null}
          {match.externalId ? (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span>{match.externalId}</span>
            </>
          ) : null}
          {match.lastSyncedAt ? (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span>同步 {formatLocalMinute(match.lastSyncedAt)}</span>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>下一步</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">{workflow.nextAction}</div>
            <p className="text-sm text-muted-foreground">{workflow.description}</p>
          </div>
          <Badge>{workflow.label}</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>盘口</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>{odds.length} 条 snapshot</div>
            <div>{latestOdds ? `${latestOdds.bookmaker} · ${latestOdds.market} · ${latestOdds.decimalOdds}` : "暂无盘口"}</div>
          </CardContent>
        </Card>
        <Link href={`/intents?matchId=${encodeURIComponent(id)}`} className="block">
          <Card className="transition-colors hover:border-foreground/40 hover:bg-muted/40">
            <CardHeader><CardTitle>决策</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{intents.length} 条 intent</CardContent>
          </Card>
        </Link>
        <Link href={`/intents?matchId=${encodeURIComponent(id)}&view=attempts`} className="block">
          <Card className="transition-colors hover:border-foreground/40 hover:bg-muted/40">
            <CardHeader><CardTitle>执行</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{attempts.length} 次 attempt</CardContent>
          </Card>
        </Link>
        <Link href={`/bets?matchId=${encodeURIComponent(id)}`} className="block">
          <Card className="transition-colors hover:border-foreground/40 hover:bg-muted/40">
            <CardHeader><CardTitle>注单</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {slips.length} 张 slip · 未结算 {openSlips.length}
            </CardContent>
          </Card>
        </Link>
      </div>

      <CodexAnalysisPanel matchId={id} oddsOptions={oddsOptions} />

      <OddsEntryForm matchId={id} />

      <MatchResultForm matchId={id} latestResult={latestResult} />

      {hasSettlementCandidates ? (
        <Card>
          <CardHeader>
            <CardTitle>待结算提示</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              比赛已记录结束，存在 {openSlips.length} 张未结算 slip。系统只提示，不会自动结算或改动资金。
            </p>
            <div className="space-y-2">
              {openSlips.map((slip) => (
                <div key={slip.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="font-mono text-xs">{slip.id}</span>
                  <span>
                    stake {formatCny(slip.stakeCents)} · odds {slip.finalOdds.toFixed(2)} · potential{" "}
                    {formatCny(slip.potentialReturnCents)}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/bets" className="inline-flex text-sm font-medium underline underline-offset-4">
              去注单中心结算
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>赔率快照</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {latestMarketAnalysis ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">
                  最近盘口组 · {latestOdds?.bookmaker} · {latestOdds?.market}
                </div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  overround {(latestMarketAnalysis.overround * 100).toFixed(2)}%
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {latestMarketAnalysis.outcomes.map((outcome) => (
                  <div key={outcome.id} className="rounded border bg-background px-2 py-1.5">
                    <div className="truncate font-medium">{outcome.id}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      fair {(outcome.fairProbability * 100).toFixed(1)}% · 公允 {outcome.fairOdds.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {odds.slice(0, 8).map((snapshot) => (
            <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="font-medium">
                {snapshot.bookmaker} · {snapshot.market} · {snapshot.selection}
                {snapshot.line ? ` ${snapshot.line}` : ""}
              </div>
              <div className="font-mono text-xs tabular-nums text-muted-foreground">
                {snapshot.decimalOdds.toFixed(2)} · implied{" "}
                {(analyzeOddsSnapshot({ decimalOdds: snapshot.decimalOdds }).impliedProbability * 100).toFixed(1)}% ·{" "}
                {formatLocalMinute(snapshot.capturedAt)}
              </div>
            </div>
          ))}
          {odds.length === 0 ? <p className="text-sm text-muted-foreground">暂无赔率快照。</p> : null}
        </CardContent>
      </Card>

      {settlementRows.length ? (
        <Card>
          <CardHeader>
            <CardTitle>结算记录</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {settlementRows.length} 条 settlement 已记录。
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
