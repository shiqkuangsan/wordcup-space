import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { codexPredictions, matches } from "@/db/schema";
import { getScoreOutcome } from "@/domain/predictions";
import { createId } from "@/server/actions/ids";

const predictionSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1).optional(),
  note: z.string().optional(),
});

const upsertCodexPredictionSchema = z.object({
  id: z.string().min(1).optional(),
  matchId: z.string().min(1),
  predictedBy: z.string().min(1).default("codex"),
  predictionScope: z.string().min(1).default("full_time"),
  predictedHomeScore: z.number().int().nonnegative(),
  predictedAwayScore: z.number().int().nonnegative(),
  predictedOutcome: z.string().min(1).optional(),
  confidence: z.string().min(1),
  dataMode: z.string().min(1).default("offline"),
  rationale: z.string().min(1),
  riskNote: z.string().min(1),
  sources: z.array(predictionSourceSchema).optional(),
  modelSnapshot: z.record(z.string(), z.unknown()).optional(),
  status: z.string().min(1).default("predicted"),
  predictedAt: z.string().min(1).optional(),
  actualHomeScore: z.number().int().nonnegative().optional(),
  actualAwayScore: z.number().int().nonnegative().optional(),
  actualOutcome: z.string().min(1).optional(),
  resultSourceNote: z.string().optional(),
  resultCheckedAt: z.string().optional(),
});

function serializePredictionEvidence({
  sources,
  modelSnapshot,
}: {
  sources?: Array<z.infer<typeof predictionSourceSchema>>;
  modelSnapshot?: Record<string, unknown>;
}) {
  if (modelSnapshot) {
    return JSON.stringify({
      sources: sources ?? [],
      modelSnapshot,
    });
  }

  return sources ? JSON.stringify(sources) : undefined;
}

export async function upsertCodexPrediction(input: z.input<typeof upsertCodexPredictionSchema>) {
  const data = upsertCodexPredictionSchema.parse(input);
  const db = getDb();
  const match = db.select().from(matches).where(eq(matches.id, data.matchId)).get();
  if (!match) throw new Error(`match not found: ${data.matchId}`);

  const now = new Date().toISOString();
  const predictedOutcome = data.predictedOutcome ?? getScoreOutcome(data.predictedHomeScore, data.predictedAwayScore);
  const hasActualScore = data.actualHomeScore !== undefined && data.actualAwayScore !== undefined;
  const actualOutcome = hasActualScore
    ? data.actualOutcome ?? getScoreOutcome(data.actualHomeScore as number, data.actualAwayScore as number)
    : data.actualOutcome;
  const scoreHit = hasActualScore
    ? data.predictedHomeScore === data.actualHomeScore && data.predictedAwayScore === data.actualAwayScore
    : undefined;
  const outcomeHit = actualOutcome ? predictedOutcome === actualOutcome : undefined;
  const status = data.status === "predicted" && hasActualScore ? "settled" : data.status;

  const row = {
    id: data.id ?? createId("prediction"),
    matchId: data.matchId,
    predictedBy: data.predictedBy,
    predictionScope: data.predictionScope,
    predictedHomeScore: data.predictedHomeScore,
    predictedAwayScore: data.predictedAwayScore,
    predictedOutcome,
    confidence: data.confidence,
    dataMode: data.dataMode,
    rationale: data.rationale,
    riskNote: data.riskNote,
    sourcesJson: serializePredictionEvidence({ sources: data.sources, modelSnapshot: data.modelSnapshot }),
    status,
    predictedAt: data.predictedAt ?? now,
    actualHomeScore: data.actualHomeScore,
    actualAwayScore: data.actualAwayScore,
    actualOutcome,
    scoreHit,
    outcomeHit,
    resultSourceNote: data.resultSourceNote,
    resultCheckedAt: data.resultCheckedAt ?? (hasActualScore ? now : undefined),
    updatedAt: now,
  };

  db.insert(codexPredictions)
    .values(row)
    .onConflictDoUpdate({
      target: [codexPredictions.matchId, codexPredictions.predictedBy, codexPredictions.predictionScope],
      set: {
        predictedHomeScore: row.predictedHomeScore,
        predictedAwayScore: row.predictedAwayScore,
        predictedOutcome: row.predictedOutcome,
        confidence: row.confidence,
        dataMode: row.dataMode,
        rationale: row.rationale,
        riskNote: row.riskNote,
        sourcesJson: row.sourcesJson,
        status: row.status,
        predictedAt: row.predictedAt,
        actualHomeScore: row.actualHomeScore,
        actualAwayScore: row.actualAwayScore,
        actualOutcome: row.actualOutcome,
        scoreHit: row.scoreHit,
        outcomeHit: row.outcomeHit,
        resultSourceNote: row.resultSourceNote,
        resultCheckedAt: row.resultCheckedAt,
        updatedAt: now,
      },
    })
    .run();

  return db
    .select()
    .from(codexPredictions)
    .where(and(
      eq(codexPredictions.matchId, row.matchId),
      eq(codexPredictions.predictedBy, row.predictedBy),
      eq(codexPredictions.predictionScope, row.predictionScope),
    ))
    .get();
}
