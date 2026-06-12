import Link from "next/link";
import { desc } from "drizzle-orm";
import { Brain, CheckCircle2, Target, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db/client";
import { codexPredictions, matches, matchResults } from "@/db/schema";
import { formatLocalMinute } from "@/domain/dates";
import { formatPredictionConfidence, formatPredictionDataMode, formatPredictionOutcome, formatPredictionStatus } from "@/domain/predictions";
import { formatMatchStatus } from "@/domain/match-sync";
import { formatMatchTitle, formatTeamName } from "@/domain/team-names";

export const dynamic = "force-dynamic";

type Prediction = typeof codexPredictions.$inferSelect;
type Match = typeof matches.$inferSelect;
type MatchResult = typeof matchResults.$inferSelect;

function ScoreBadge({ prediction }: { prediction: Prediction }) {
  if (prediction.scoreHit === true) {
    return <Badge className="gap-1"><CheckCircle2 className="size-3" />比分命中</Badge>;
  }
  if (prediction.scoreHit === false) {
    return <Badge variant="secondary" className="gap-1"><XCircle className="size-3" />比分未中</Badge>;
  }
  return <Badge variant="outline">待赛果</Badge>;
}

function OutcomeBadge({ prediction }: { prediction: Prediction }) {
  if (prediction.outcomeHit === true) return <Badge variant="outline">胜平负命中</Badge>;
  if (prediction.outcomeHit === false) return <Badge variant="secondary">胜平负未中</Badge>;
  return <Badge variant="outline">待核对</Badge>;
}

function PredictionCard({
  prediction,
  match,
  result,
}: {
  prediction: Prediction;
  match?: Match;
  result?: MatchResult;
}) {
  const title = match ? formatMatchTitle(match.homeTeam, match.awayTeam) : prediction.matchId;
  const actualHomeScore = prediction.actualHomeScore ?? result?.homeScore;
  const actualAwayScore = prediction.actualAwayScore ?? result?.awayScore;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg tracking-normal">
              {match ? <Link href={`/matches/${match.id}`} className="hover:underline">{title}</Link> : title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {match ? `${formatLocalMinute(match.kickoffAt)} · ${formatMatchStatus(match.status)}` : prediction.matchId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ScoreBadge prediction={prediction} />
            <OutcomeBadge prediction={prediction} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">预测比分</p>
            <p className="mt-1 font-mono text-2xl">
              {prediction.predictedHomeScore}-{prediction.predictedAwayScore}
            </p>
            <p className="text-xs text-muted-foreground">{formatPredictionOutcome(prediction.predictedOutcome)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">真实比分</p>
            <p className="mt-1 font-mono text-2xl">
              {actualHomeScore ?? "-"}-{actualAwayScore ?? "-"}
            </p>
            <p className="text-xs text-muted-foreground">
              {prediction.actualOutcome ? formatPredictionOutcome(prediction.actualOutcome) : "待核对"}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">置信度</p>
            <p className="mt-1 text-xl font-semibold">{formatPredictionConfidence(prediction.confidence)}</p>
            <p className="text-xs text-muted-foreground">{formatPredictionDataMode(prediction.dataMode)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">状态</p>
            <p className="mt-1 text-xl font-semibold">{formatPredictionStatus(prediction.status)}</p>
            <p className="text-xs text-muted-foreground">{prediction.predictedBy}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium">预测理由</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{prediction.rationale}</p>
          </div>
          <div>
            <p className="text-sm font-medium">主要风险</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{prediction.riskNote}</p>
          </div>
        </div>
        {prediction.resultSourceNote ? (
          <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            赛果来源：{prediction.resultSourceNote}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function PredictionsPage() {
  const db = getDb();
  const predictions = db.select().from(codexPredictions).orderBy(desc(codexPredictions.predictedAt)).all();
  const allMatches = db.select().from(matches).all();
  const allResults = db.select().from(matchResults).all();
  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const resultsByMatchId = new Map(allResults.map((result) => [result.matchId, result]));
  const settled = predictions.filter((prediction) => prediction.status === "settled");
  const scoreHits = settled.filter((prediction) => prediction.scoreHit).length;
  const outcomeHits = settled.filter((prediction) => prediction.outcomeHit).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Codex 预测</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            记录每周赛前比分预测，赛后核对比分和胜平负命中情况。
          </p>
        </div>
        <Badge variant="outline">{predictions.length} 条预测</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Brain className="size-4" />总预测</CardTitle></CardHeader>
          <CardContent className="font-mono text-2xl">{predictions.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="size-4" />比分命中</CardTitle></CardHeader>
          <CardContent className="font-mono text-2xl">{scoreHits}/{settled.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4" />胜平负命中</CardTitle></CardHeader>
          <CardContent className="font-mono text-2xl">{outcomeHits}/{settled.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>预测明细</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>比赛</TableHead>
                <TableHead>预测</TableHead>
                <TableHead>真实</TableHead>
                <TableHead>命中</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictions.map((prediction) => {
                const match = matchesById.get(prediction.matchId);
                const result = resultsByMatchId.get(prediction.matchId);
                const actualHomeScore = prediction.actualHomeScore ?? result?.homeScore;
                const actualAwayScore = prediction.actualAwayScore ?? result?.awayScore;

                return (
                  <TableRow key={prediction.id}>
                    <TableCell>
                      <div className="font-medium">
                        {match ? (
                          <Link href={`/matches/${match.id}`} className="hover:underline">
                            {formatTeamName(match.homeTeam)} vs {formatTeamName(match.awayTeam)}
                          </Link>
                        ) : prediction.matchId}
                      </div>
                      <div className="text-xs text-muted-foreground">{match ? formatLocalMinute(match.kickoffAt) : ""}</div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {prediction.predictedHomeScore}-{prediction.predictedAwayScore}
                    </TableCell>
                    <TableCell className="font-mono">
                      {actualHomeScore ?? "-"}-{actualAwayScore ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <ScoreBadge prediction={prediction} />
                        <OutcomeBadge prediction={prediction} />
                      </div>
                    </TableCell>
                    <TableCell>{formatPredictionStatus(prediction.status)}</TableCell>
                  </TableRow>
                );
              })}
              {predictions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">暂无预测记录。</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {predictions.map((prediction) => (
          <PredictionCard
            key={prediction.id}
            prediction={prediction}
            match={matchesById.get(prediction.matchId)}
            result={resultsByMatchId.get(prediction.matchId)}
          />
        ))}
      </div>
    </div>
  );
}
