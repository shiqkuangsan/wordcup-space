import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function getWorkflowCta(key: ReturnType<typeof getMatchWorkflowStatus>["key"], matchId: string) {
  switch (key) {
    case "needs_odds":
      return { label: "去录盘口", href: "#odds-entry" };
    case "needs_analysis":
      return { label: "生成 dry-run", href: "#codex-analysis" };
    case "needs_execution":
      return { label: "去决策队列", href: `/intents?matchId=${encodeURIComponent(matchId)}` };
    case "waiting_result":
      return { label: "记录赛果", href: "#match-result" };
    case "needs_settlement":
      return { label: "去结算", href: `/bets?matchId=${encodeURIComponent(matchId)}` };
    case "needs_review":
      return { label: "看结算记录", href: "#settlements" };
  }
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
  const workflowCta = getWorkflowCta(workflow.key, id);
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
          <div className="max-w-2xl">
            <div className="font-medium">{workflow.nextAction}</div>
            <p className="text-sm text-muted-foreground">{workflow.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{workflow.label}</Badge>
            <Button asChild>
              <Link href={workflowCta.href}>{workflowCta.label}</Link>
            </Button>
          </div>
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

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="analysis">赛前分析</TabsTrigger>
          <TabsTrigger value="execution">执行记录</TabsTrigger>
          <TabsTrigger value="postmatch">赛后结算</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div id="codex-analysis" className="scroll-mt-4">
            <CodexAnalysisPanel matchId={id} oddsOptions={oddsOptions} />
          </div>

          <div id="odds-entry" className="scroll-mt-4">
            <OddsEntryForm matchId={id} />
          </div>

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
        </TabsContent>

        <TabsContent value="execution" className="grid gap-4 lg:grid-cols-3">
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
        </TabsContent>

        <TabsContent value="postmatch" className="space-y-4">
          <div id="match-result" className="scroll-mt-4">
            <MatchResultForm matchId={id} latestResult={latestResult} />
          </div>

          {hasSettlementCandidates ? (
            <Card id="settlement-prompt" className="scroll-mt-4">
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

          <Card id="settlements" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>结算记录</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {settlementRows.length ? `${settlementRows.length} 条 settlement 已记录。` : "暂无 settlement。"}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
