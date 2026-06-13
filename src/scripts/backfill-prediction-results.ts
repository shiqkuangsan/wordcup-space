import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { codexPredictions, matchResults } from "@/db/schema";
import { getScoreOutcome } from "@/domain/predictions";

function main() {
  const db = getDb();
  const predictions = db.select().from(codexPredictions).all();
  const resultsByMatchId = new Map(
    db.select().from(matchResults).all().map((result) => [result.matchId, result]),
  );
  const now = new Date().toISOString();
  let updated = 0;

  for (const prediction of predictions) {
    const result = resultsByMatchId.get(prediction.matchId);
    const actualHomeScore = prediction.actualHomeScore ?? result?.homeScore;
    const actualAwayScore = prediction.actualAwayScore ?? result?.awayScore;
    if (actualHomeScore === null || actualHomeScore === undefined || actualAwayScore === null || actualAwayScore === undefined) {
      continue;
    }

    const actualOutcome = prediction.actualOutcome ?? getScoreOutcome(actualHomeScore, actualAwayScore);
    const scoreHit = prediction.predictedHomeScore === actualHomeScore && prediction.predictedAwayScore === actualAwayScore;
    const outcomeHit = prediction.predictedOutcome === actualOutcome;
    const status = prediction.status === "predicted" ? "settled" : prediction.status;
    const resultCheckedAt = prediction.resultCheckedAt ?? result?.settledAt ?? now;
    const resultSourceNote = prediction.resultSourceNote ?? result?.sourceNote;

    const needsUpdate =
      prediction.actualHomeScore !== actualHomeScore ||
      prediction.actualAwayScore !== actualAwayScore ||
      prediction.actualOutcome !== actualOutcome ||
      prediction.scoreHit !== scoreHit ||
      prediction.outcomeHit !== outcomeHit ||
      prediction.status !== status ||
      prediction.resultCheckedAt !== resultCheckedAt ||
      prediction.resultSourceNote !== resultSourceNote;

    if (!needsUpdate) continue;

    db.update(codexPredictions)
      .set({
        actualHomeScore,
        actualAwayScore,
        actualOutcome,
        scoreHit,
        outcomeHit,
        status,
        resultSourceNote,
        resultCheckedAt,
        updatedAt: now,
      })
      .where(eq(codexPredictions.id, prediction.id))
      .run();
    updated += 1;
  }

  console.log(`Backfilled ${updated} codex prediction result row(s).`);
}

main();
