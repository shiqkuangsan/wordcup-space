import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MatchOddsBoard } from "@/components/matches/odds-source-table";
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
import { formatMatchTitle } from "@/domain/team-names";

export const dynamic = "force-dynamic";

type OddsSnapshot = typeof oddsSnapshots.$inferSelect;

function getLatestOddsGroupsBySource(odds: OddsSnapshot[]) {
  const groups = new Map<string, OddsSnapshot[]>();

  for (const snapshot of odds) {
    const key = `${snapshot.bookmaker}:${snapshot.market}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, [snapshot]);
      continue;
    }
    if (snapshot.capturedAt === existing[0].capturedAt) {
      existing.push(snapshot);
    }
  }

  return Array.from(groups.values());
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
    resultStatus: latestResult?.resultStatus,
    oddsCount: odds.length,
    intentCount: intents.length,
    slipCount: slips.length,
    openSlipCount: openSlips.length,
  });
  const latestOddsGroups = getLatestOddsGroupsBySource(odds);

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

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">盘口信息</h3>
            <p className="text-sm text-muted-foreground">只读查看当前比赛已保存的最新盘口快照。</p>
          </div>
          <Badge variant="outline">{odds.length} 条 snapshot</Badge>
        </div>
        <MatchOddsBoard groups={latestOddsGroups} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>盘口</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>{odds.length} 条 snapshot</div>
            <div>{latestOddsGroups.length} 个最新盘口组</div>
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

      <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>决策 intent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {intents.slice(0, 6).map((intent) => (
                <Link
                  key={intent.id}
                  href={`/intents?matchId=${encodeURIComponent(id)}`}
                  className="block rounded-md border px-3 py-2 transition-colors hover:border-foreground/40 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{intent.id}</span>
                    <Badge variant="outline">{intent.status}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {intent.decisionBy} · {formatCny(intent.intendedStakeCents)} · {intent.intendedTotalOdds.toFixed(2)}
                  </div>
                </Link>
              ))}
              {intents.length === 0 ? <p className="text-muted-foreground">暂无 intent。</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>执行 attempt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {attempts.slice(0, 6).map((attempt) => (
                <div key={attempt.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{attempt.id}</span>
                    <Badge variant="outline">{attempt.status}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    intended {attempt.intendedOdds.toFixed(2)}
                    {attempt.observedOdds ? ` · observed ${attempt.observedOdds.toFixed(2)}` : ""}
                  </div>
                </div>
              ))}
              {attempts.length === 0 ? <p className="text-muted-foreground">暂无 attempt。</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>注单 slip</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {slips.slice(0, 6).map((slip) => (
                <Link
                  key={slip.id}
                  href={`/bets?matchId=${encodeURIComponent(id)}`}
                  className="block rounded-md border px-3 py-2 transition-colors hover:border-foreground/40 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{slip.id}</span>
                    <Badge variant="outline">{slip.status}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    stake {formatCny(slip.stakeCents)} · odds {slip.finalOdds.toFixed(2)}
                  </div>
                </Link>
              ))}
              {slips.length === 0 ? <p className="text-muted-foreground">暂无 slip。</p> : null}
            </CardContent>
          </Card>
      </section>

      <Card id="settlements" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>结算记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>{settlementRows.length ? `${settlementRows.length} 条 settlement 已记录。` : "暂无 settlement。"}</div>
          {hasSettlementCandidates ? <div>存在 {openSlips.length} 张未结算 slip；此页只提示，不处理。</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
