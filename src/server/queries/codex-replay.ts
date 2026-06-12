import { getDb } from "@/db/client";
import {
  betIntentLegs,
  betIntents,
  betSlips,
  executionAttempts,
  matches,
  matchResults,
  settlements,
} from "@/db/schema";
import { getEffectiveIntentStatus, isIntentExecutable } from "@/domain/bet-lifecycle";
import { settleIntentLegFromMatchResult, type ReplaySettlementOutcome } from "@/domain/codex-replay";
import { formatMatchTitle } from "@/domain/team-names";

type CodexIntent = typeof betIntents.$inferSelect;
type BetSlip = typeof betSlips.$inferSelect;
type ExecutionAttempt = typeof executionAttempts.$inferSelect;
type Settlement = typeof settlements.$inferSelect;

export type CodexReplayExecutionStatus = "placed" | "execution_failed" | "not_adopted" | "pending_execution";

export type CodexReplayRow = {
  intentId: string;
  createdAt: string;
  status: string;
  effectiveStatus: string;
  executionStatus: CodexReplayExecutionStatus;
  matchTitle: string;
  matchHref?: string;
  market: string;
  selection: string;
  line?: string | null;
  stakeCents: number;
  odds: number;
  theoreticalStatus: ReplaySettlementOutcome["status"];
  theoreticalResult?: string;
  theoreticalProfitLossCents: number | null;
  theoreticalReason?: string;
  actualSlipId?: string;
  actualStatus: "settled" | "open" | "not_placed";
  actualProfitLossCents: number | null;
};

type ReplayActualStatus = CodexReplayRow["actualStatus"];

export type CodexReplaySummary = {
  theoretical: {
    settledCount: number;
    pendingCount: number;
    unsupportedCount: number;
    stakeCents: number;
    profitLossCents: number;
    roi: number | null;
  };
  actualCodex: {
    settledCount: number;
    openCount: number;
    stakeCents: number;
    profitLossCents: number;
    roi: number | null;
  };
  actualAll: {
    settledCount: number;
    openCount: number;
    stakeCents: number;
    profitLossCents: number;
    roi: number | null;
  };
  execution: {
    placedCount: number;
    failedCount: number;
    notAdoptedCount: number;
    pendingCount: number;
  };
  deltaVsActualCodexCents: number | null;
  deltaVsActualAllCents: number | null;
  rows: CodexReplayRow[];
};

function groupBy<T, K>(rows: T[], keyFn: (row: T) => K) {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = map.get(key) ?? [];
    existing.push(row);
    map.set(key, existing);
  }
  return map;
}

function getExecutionStatus({
  intent,
  slips,
  attempts,
  now,
}: {
  intent: CodexIntent;
  slips: BetSlip[];
  attempts: ExecutionAttempt[];
  now: Date;
}): CodexReplayExecutionStatus {
  if (slips.length > 0) return "placed";
  if (attempts.some((attempt) => attempt.status === "failed")) return "execution_failed";
  if (isIntentExecutable(intent, now)) return "pending_execution";
  return "not_adopted";
}

function summarizeActual(slips: BetSlip[], settlementsBySlip: Map<string, Settlement>) {
  const settled = slips.filter((slip) => settlementsBySlip.has(slip.id));
  const open = slips.filter((slip) => slip.status === "open");
  const stakeCents = settled.reduce((sum, slip) => sum + slip.stakeCents, 0);
  const profitLossCents = settled.reduce((sum, slip) => sum + (settlementsBySlip.get(slip.id)?.profitLossCents ?? 0), 0);

  return {
    settledCount: settled.length,
    openCount: open.length,
    stakeCents,
    profitLossCents,
    roi: stakeCents > 0 ? profitLossCents / stakeCents : null,
  };
}

export function getCodexReplaySummary(now = new Date()): CodexReplaySummary {
  const db = getDb();
  const allMatches = db.select().from(matches).all();
  const allResults = db.select().from(matchResults).all();
  const intents = db.select().from(betIntents).all();
  const codexIntents = intents.filter((intent) => intent.decisionBy === "codex");
  const legs = db.select().from(betIntentLegs).all();
  const slips = db.select().from(betSlips).all();
  const attempts = db.select().from(executionAttempts).all();
  const settlementRows = db.select().from(settlements).all();

  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const resultsByMatchId = new Map(allResults.map((result) => [result.matchId, result]));
  const legsByIntent = groupBy(legs, (leg) => leg.betIntentId);
  const slipsByIntent = groupBy(slips, (slip) => slip.betIntentId);
  const attemptsByIntent = groupBy(attempts, (attempt) => attempt.betIntentId);
  const settlementsBySlip = new Map(settlementRows.map((settlement) => [settlement.betSlipId, settlement]));

  const rows: CodexReplayRow[] = codexIntents
    .map((intent) => {
      const intentLegs = legsByIntent.get(intent.id) ?? [];
      const firstLeg = intentLegs[0];
      const match = firstLeg?.matchId ? matchesById.get(firstLeg.matchId) : undefined;
      const result = firstLeg?.matchId ? resultsByMatchId.get(firstLeg.matchId) : undefined;
      const intentSlips = slipsByIntent.get(intent.id) ?? [];
      const firstSlip = intentSlips[0];
      const settlement = firstSlip ? settlementsBySlip.get(firstSlip.id) : undefined;
      const actualStatus: ReplayActualStatus = settlement ? "settled" : firstSlip ? "open" : "not_placed";
      const executionStatus = getExecutionStatus({
        intent,
        slips: intentSlips,
        attempts: attemptsByIntent.get(intent.id) ?? [],
        now,
      });
      let theoretical: ReplaySettlementOutcome;

      if (intentLegs.length !== 1 || !firstLeg) {
        theoretical = { status: "unsupported_market", reason: intentLegs.length === 0 ? "missing intent leg" : "parlay replay is not supported yet" };
      } else {
        theoretical = settleIntentLegFromMatchResult({
          leg: firstLeg,
          matchResult: match
            ? {
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                homeScore: result?.homeScore ?? null,
                awayScore: result?.awayScore ?? null,
                resultStatus: result?.resultStatus ?? null,
              }
            : null,
          stakeCents: intent.intendedStakeCents,
          odds: intent.intendedTotalOdds,
        });
      }

      return {
        intentId: intent.id,
        createdAt: intent.createdAt,
        status: intent.status,
        effectiveStatus: getEffectiveIntentStatus(intent, now),
        executionStatus,
        matchTitle: match ? formatMatchTitle(match.homeTeam, match.awayTeam) : (firstLeg?.matchText ?? "未绑定比赛"),
        matchHref: match ? `/matches/${match.id}` : undefined,
        market: firstLeg?.market ?? intent.market ?? "unknown",
        selection: firstLeg?.selection ?? "-",
        line: firstLeg?.line,
        stakeCents: intent.intendedStakeCents,
        odds: intent.intendedTotalOdds,
        theoreticalStatus: theoretical.status,
        theoreticalResult: theoretical.status === "settled" ? theoretical.result : undefined,
        theoreticalProfitLossCents: theoretical.status === "settled" ? theoretical.profitLossCents : null,
        theoreticalReason: theoretical.status === "settled" ? undefined : theoretical.reason,
        actualSlipId: firstSlip?.id,
        actualStatus,
        actualProfitLossCents: settlement?.profitLossCents ?? null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const theoreticalSettled = rows.filter((row) => row.theoreticalStatus === "settled");
  const theoreticalStakeCents = theoreticalSettled.reduce((sum, row) => sum + row.stakeCents, 0);
  const theoreticalProfitLossCents = theoreticalSettled.reduce((sum, row) => sum + (row.theoreticalProfitLossCents ?? 0), 0);
  const actualCodex = summarizeActual(slips.filter((slip) => slip.decisionBy === "codex"), settlementsBySlip);
  const actualAll = summarizeActual(slips, settlementsBySlip);

  return {
    theoretical: {
      settledCount: theoreticalSettled.length,
      pendingCount: rows.filter((row) => ["pending_result", "missing_result"].includes(row.theoreticalStatus)).length,
      unsupportedCount: rows.filter((row) => row.theoreticalStatus === "unsupported_market").length,
      stakeCents: theoreticalStakeCents,
      profitLossCents: theoreticalProfitLossCents,
      roi: theoreticalStakeCents > 0 ? theoreticalProfitLossCents / theoreticalStakeCents : null,
    },
    actualCodex,
    actualAll,
    execution: {
      placedCount: rows.filter((row) => row.executionStatus === "placed").length,
      failedCount: rows.filter((row) => row.executionStatus === "execution_failed").length,
      notAdoptedCount: rows.filter((row) => row.executionStatus === "not_adopted").length,
      pendingCount: rows.filter((row) => row.executionStatus === "pending_execution").length,
    },
    deltaVsActualCodexCents: actualCodex.settledCount > 0 ? theoreticalProfitLossCents - actualCodex.profitLossCents : null,
    deltaVsActualAllCents: actualAll.settledCount > 0 ? theoreticalProfitLossCents - actualAll.profitLossCents : null,
    rows,
  };
}
