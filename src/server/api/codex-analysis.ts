import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches, oddsSnapshots } from "@/db/schema";
import {
  analyzeOddsSnapshot,
  calculateExpectedValue,
  devigMarketProbabilities,
  fairOddsFromProbability,
} from "@/domain/odds-analysis";
import { buildIntentPreview } from "@/server/api/previews";

type OddsSnapshot = typeof oddsSnapshots.$inferSelect;

type CodexAnalysisPreviewInput = {
  matchId: string;
  oddsSnapshotId?: string;
  selection?: string;
  stake?: number;
  stakeCents?: number;
  modelProbability?: number;
  modelProbabilityPct?: number;
  portfolioId?: "user" | "codex";
  decisionBy?: "user" | "codex";
  notes?: string;
};

type Recommendation = "bet" | "pass" | "wait";

function normalizeProbability(input: CodexAnalysisPreviewInput) {
  if (typeof input.modelProbability === "number") return input.modelProbability;
  if (typeof input.modelProbabilityPct === "number") return input.modelProbabilityPct / 100;
  return undefined;
}

function normalizeStakeCents(input: CodexAnalysisPreviewInput) {
  const stakeCents =
    typeof input.stakeCents === "number"
      ? input.stakeCents
      : Math.round(Number(input.stake ?? 10) * 100);

  if (!Number.isFinite(stakeCents) || stakeCents <= 0) {
    throw new Error("stake/stakeCents must be a positive number");
  }

  return stakeCents;
}

function pickSnapshot(odds: OddsSnapshot[], input: CodexAnalysisPreviewInput) {
  if (input.oddsSnapshotId) {
    const byId = odds.find((snapshot) => snapshot.id === input.oddsSnapshotId);
    if (!byId) throw new Error(`odds snapshot not found: ${input.oddsSnapshotId}`);
    return byId;
  }

  if (input.selection) {
    const bySelection = odds.find((snapshot) => snapshot.selection === input.selection);
    if (!bySelection) throw new Error(`odds snapshot selection not found: ${input.selection}`);
    return bySelection;
  }

  const latest = odds[0];
  if (!latest) throw new Error(`no odds snapshots found for match: ${input.matchId}`);
  return latest;
}

function getSnapshotGroup(odds: OddsSnapshot[], selected: OddsSnapshot) {
  return odds.filter(
    (snapshot) =>
      snapshot.bookmaker === selected.bookmaker &&
      snapshot.market === selected.market &&
      snapshot.capturedAt === selected.capturedAt,
  );
}

function recommend(expectedValue: number | undefined): Recommendation {
  if (expectedValue === undefined) return "wait";
  if (expectedValue >= 0.03) return "bet";
  if (expectedValue < 0) return "pass";
  return "wait";
}

function confidenceFor(expectedValue: number | undefined) {
  if (expectedValue === undefined) return "low";
  if (expectedValue >= 0.08) return "high";
  if (expectedValue >= 0.03) return "medium";
  return "low";
}

function dataQualityFor(groupSize: number) {
  return groupSize >= 2 ? "market_group" : "single_snapshot";
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildCodexAnalysisPreview(input: CodexAnalysisPreviewInput) {
  if (!input.matchId) throw new Error("matchId is required");

  const db = getDb();
  const match = db.select().from(matches).where(eq(matches.id, input.matchId)).get();
  if (!match) throw new Error(`match not found: ${input.matchId}`);

  const odds = db
    .select()
    .from(oddsSnapshots)
    .where(eq(oddsSnapshots.matchId, input.matchId))
    .orderBy(desc(oddsSnapshots.capturedAt))
    .all();
  const selected = pickSnapshot(odds, input);
  const selectedOddsAnalysis = analyzeOddsSnapshot({ decimalOdds: selected.decimalOdds });
  const marketGroup = getSnapshotGroup(odds, selected);
  const devig =
    marketGroup.length >= 2
      ? devigMarketProbabilities(
          marketGroup.map((snapshot) => ({
            id: snapshot.id,
            decimalOdds: snapshot.decimalOdds,
          })),
        )
      : null;
  const selectedFair = devig?.outcomes.find((outcome) => outcome.id === selected.id);
  const marketFairProbability = selectedFair?.fairProbability ?? selectedOddsAnalysis.impliedProbability;
  const fairOdds = selectedFair?.fairOdds ?? fairOddsFromProbability(marketFairProbability);
  const modelProbability = normalizeProbability(input);

  if (modelProbability !== undefined && (!Number.isFinite(modelProbability) || modelProbability < 0 || modelProbability > 1)) {
    throw new Error("modelProbability must be between 0 and 1");
  }

  const expectedValue =
    modelProbability === undefined
      ? undefined
      : calculateExpectedValue({ modelProbability, decimalOdds: selected.decimalOdds });
  const recommendation = recommend(expectedValue);
  const confidence = confidenceFor(expectedValue);
  const riskTier = recommendation === "bet" && confidence === "high" ? "high_confidence" : "normal";
  const stakeCents = normalizeStakeCents(input);
  const warnings: string[] = [];

  if (modelProbability === undefined) {
    warnings.push("缺少 Codex 模型概率，只生成观察草稿，不建议直接执行。");
  }
  if (!devig) {
    warnings.push("当前只有单条赔率，无法去水位，只能使用原始 implied probability。");
  }

  const rationaleParts = [
    `${match.homeTeam} vs ${match.awayTeam}`,
    `${selected.bookmaker} ${selected.market} ${selected.selection} @ ${selected.decimalOdds.toFixed(2)}`,
    `市场 implied ${pct(selectedOddsAnalysis.impliedProbability)}`,
    `公允概率 ${pct(marketFairProbability)}`,
  ];

  if (modelProbability !== undefined && expectedValue !== undefined) {
    rationaleParts.push(`Codex 模型概率 ${pct(modelProbability)}`);
    rationaleParts.push(`EV ${(expectedValue * 100).toFixed(1)}%`);
  }

  if (input.notes) rationaleParts.push(input.notes);

  const intentPreview = buildIntentPreview({
    dryRun: true,
    portfolioId: input.portfolioId ?? "codex",
    decisionBy: input.decisionBy ?? "codex",
    mode: "single",
    market: selected.market,
    stakeCents,
    odds: selected.decimalOdds,
    riskTier,
    confidence,
    modelProbability,
    expectedValue,
    approvalMode: recommendation === "bet" ? "manual" : "auto",
    status: recommendation === "bet" ? "proposed" : "draft",
    rationale: rationaleParts.join("；"),
    legs: [
      {
        matchId: match.id,
        market: selected.market,
        selection: selected.selection,
        line: selected.line ?? undefined,
        intendedOdds: selected.decimalOdds,
        legOrder: 1,
        notes: `Codex dry-run analysis from odds snapshot ${selected.id}`,
      },
    ],
  });

  return {
    dryRun: true,
    writes: false,
    analysis: {
      matchId: match.id,
      matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
      recommendation,
      dataQuality: dataQualityFor(marketGroup.length),
      market: selected.market,
      bookmaker: selected.bookmaker,
      selection: selected.selection,
      line: selected.line,
      decimalOdds: selected.decimalOdds,
      marketImpliedProbability: selectedOddsAnalysis.impliedProbability,
      marketFairProbability,
      fairOdds,
      modelProbability,
      expectedValue,
      riskTier,
      confidence,
      stakeCents,
      rationale: rationaleParts,
      sources: [
        {
          type: "match",
          id: match.id,
          dataSource: match.dataSource,
          externalId: match.externalId,
          lastSyncedAt: match.lastSyncedAt,
        },
        {
          type: "odds_snapshot",
          id: selected.id,
          sourceActor: selected.sourceActor,
          sourceType: selected.sourceType,
          sourceNote: selected.sourceNote,
          capturedAt: selected.capturedAt,
        },
      ],
    },
    intentPreview,
    warnings: [...warnings, ...intentPreview.warnings],
  };
}
