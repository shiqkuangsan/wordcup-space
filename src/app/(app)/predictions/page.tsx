import { Brain, CheckCircle2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PredictionListDrawer, type PredictionListItem } from "@/components/predictions/prediction-list-drawer";
import { getDb } from "@/db/client";
import { codexPredictions, matches, matchResults } from "@/db/schema";
import { formatLocalMinute } from "@/domain/dates";
import { formatMatchStatus } from "@/domain/match-sync";
import { getScoreOutcome } from "@/domain/predictions";
import { formatMatchTitle, formatTeamName } from "@/domain/team-names";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const db = getDb();
  const predictions = db.select().from(codexPredictions).all();
  const allMatches = db.select().from(matches).all();
  const allResults = db.select().from(matchResults).all();
  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const resultsByMatchId = new Map(allResults.map((result) => [result.matchId, result]));
  const sortedPredictions = [...predictions].sort((left, right) => {
    const leftMatch = matchesById.get(left.matchId);
    const rightMatch = matchesById.get(right.matchId);
    const leftTime = leftMatch ? new Date(leftMatch.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = rightMatch ? new Date(rightMatch.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return new Date(left.predictedAt).getTime() - new Date(right.predictedAt).getTime();
  });
  const predictionItems: PredictionListItem[] = sortedPredictions.map((prediction) => {
    const match = matchesById.get(prediction.matchId);
    const result = resultsByMatchId.get(prediction.matchId);
    const actualHomeScore = prediction.actualHomeScore ?? result?.homeScore;
    const actualAwayScore = prediction.actualAwayScore ?? result?.awayScore;
    const actualOutcome =
      prediction.actualOutcome ??
      (actualHomeScore !== null && actualHomeScore !== undefined && actualAwayScore !== null && actualAwayScore !== undefined
        ? getScoreOutcome(actualHomeScore, actualAwayScore)
        : null);
    const derivedScoreHit =
      actualHomeScore !== null && actualHomeScore !== undefined && actualAwayScore !== null && actualAwayScore !== undefined
        ? prediction.predictedHomeScore === actualHomeScore && prediction.predictedAwayScore === actualAwayScore
        : null;
    const derivedOutcomeHit = actualOutcome ? prediction.predictedOutcome === actualOutcome : null;
    const title = match ? formatMatchTitle(match.homeTeam, match.awayTeam) : prediction.matchId;

    return {
      id: prediction.id,
      matchId: prediction.matchId,
      matchTitle: match ? `${formatTeamName(match.homeTeam)} vs ${formatTeamName(match.awayTeam)}` : title,
      matchHref: match ? `/matches/${match.id}` : undefined,
      kickoffLabel: match ? formatLocalMinute(match.kickoffAt) : undefined,
      matchStatus: match ? formatMatchStatus(match.status) : undefined,
      predictedBy: prediction.predictedBy,
      predictedHomeScore: prediction.predictedHomeScore,
      predictedAwayScore: prediction.predictedAwayScore,
      predictedOutcome: prediction.predictedOutcome,
      confidence: prediction.confidence,
      dataMode: prediction.dataMode,
      status: prediction.status,
      rationale: prediction.rationale,
      riskNote: prediction.riskNote,
      predictedAt: formatLocalMinute(prediction.predictedAt),
      actualHomeScore,
      actualAwayScore,
      actualOutcome,
      scoreHit: prediction.scoreHit ?? derivedScoreHit,
      outcomeHit: prediction.outcomeHit ?? derivedOutcomeHit,
      resultSourceNote: prediction.resultSourceNote ?? result?.sourceNote ?? null,
      resultCheckedAt: prediction.resultCheckedAt,
    };
  });
  const scoreChecked = predictionItems.filter((prediction) => prediction.scoreHit !== null && prediction.scoreHit !== undefined);
  const outcomeChecked = predictionItems.filter((prediction) => prediction.outcomeHit !== null && prediction.outcomeHit !== undefined);
  const scoreHits = scoreChecked.filter((prediction) => prediction.scoreHit).length;
  const outcomeHits = outcomeChecked.filter((prediction) => prediction.outcomeHit).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Codex 预测</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            记录每周赛前比分预测，赛后分开核对比分命中和赛果命中。
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
          <CardContent className="font-mono text-2xl">{scoreHits}/{scoreChecked.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4" />赛果命中</CardTitle></CardHeader>
          <CardContent className="font-mono text-2xl">{outcomeHits}/{outcomeChecked.length}</CardContent>
        </Card>
      </div>

      <PredictionListDrawer items={predictionItems} />
    </div>
  );
}
