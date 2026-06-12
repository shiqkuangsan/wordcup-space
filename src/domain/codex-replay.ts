import { calculateSettlement, type SettlementResult } from "@/domain/settlement";

export type ReplayMatchResult = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  resultStatus?: string | null;
};

export type ReplayIntentLeg = {
  market: string;
  selection: string;
  line?: string | null;
};

export type ReplaySettlementOutcome =
  | {
      status: "settled";
      result: Exclude<SettlementResult, "cashout">;
      payoutCents: number;
      profitLossCents: number;
    }
  | {
      status: "pending_result" | "unsupported_market" | "missing_result";
      reason: string;
    };

type UnitResult = "won" | "lost" | "void";

function hasFinalScore(result: ReplayMatchResult) {
  return result.resultStatus === "finished" && result.homeScore !== null && result.awayScore !== null;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function parseAsianLine(line?: string | null) {
  if (!line) throw new Error("missing line");
  const values = line
    .split("/")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) throw new Error(`invalid line: ${line}`);
  return values.length === 1 ? [values[0]] : values.slice(0, 2);
}

function unitResultToSettlement(results: UnitResult[]): Exclude<SettlementResult, "cashout"> {
  const won = results.filter((result) => result === "won").length;
  const lost = results.filter((result) => result === "lost").length;
  const voided = results.filter((result) => result === "void").length;

  if (won === results.length) return "won";
  if (lost === results.length) return "lost";
  if (voided === results.length) return "void";
  if (won > 0 && voided > 0 && lost === 0) return "half_won";
  if (lost > 0 && voided > 0 && won === 0) return "half_lost";

  return "void";
}

function compareToUnitResult(value: number): UnitResult {
  if (value > 0) return "won";
  if (value < 0) return "lost";
  return "void";
}

function isHomeSelection(selection: string, result: ReplayMatchResult) {
  const selected = normalize(selection);
  return ["home", "主胜", "主队", "1"].includes(selected) || selected === normalize(result.homeTeam);
}

function isAwaySelection(selection: string, result: ReplayMatchResult) {
  const selected = normalize(selection);
  return ["away", "客胜", "客队", "2"].includes(selected) || selected === normalize(result.awayTeam);
}

function settleMoneyline(leg: ReplayIntentLeg, result: ReplayMatchResult): Exclude<SettlementResult, "cashout"> | null {
  const homeWon = Number(result.homeScore) > Number(result.awayScore);
  const awayWon = Number(result.awayScore) > Number(result.homeScore);
  const selected = normalize(leg.selection);

  if (["和局", "平局", "平", "draw", "x"].includes(selected)) {
    return homeWon || awayWon ? "lost" : "won";
  }
  if (isHomeSelection(leg.selection, result)) return homeWon ? "won" : "lost";
  if (isAwaySelection(leg.selection, result)) return awayWon ? "won" : "lost";
  return null;
}

function settleCorrectScore(leg: ReplayIntentLeg, result: ReplayMatchResult): Exclude<SettlementResult, "cashout"> | null {
  const match = leg.selection.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return Number(match[1]) === result.homeScore && Number(match[2]) === result.awayScore ? "won" : "lost";
}

function settleTotal(leg: ReplayIntentLeg, result: ReplayMatchResult): Exclude<SettlementResult, "cashout"> {
  const goals = Number(result.homeScore) + Number(result.awayScore);
  const selected = normalize(leg.selection);
  const isOver = ["大", "over", "o"].includes(selected);
  const lines = parseAsianLine(leg.line);
  const units = lines.map((line) => compareToUnitResult(isOver ? goals - line : line - goals));
  return unitResultToSettlement(units);
}

function settleHandicap(leg: ReplayIntentLeg, result: ReplayMatchResult): Exclude<SettlementResult, "cashout"> | null {
  const lines = parseAsianLine(leg.line);
  const homeSelected = isHomeSelection(leg.selection, result);
  const awaySelected = isAwaySelection(leg.selection, result);
  if (!homeSelected && !awaySelected) return null;

  const selectedScore = homeSelected ? Number(result.homeScore) : Number(result.awayScore);
  const opponentScore = homeSelected ? Number(result.awayScore) : Number(result.homeScore);
  const units = lines.map((line) => compareToUnitResult(selectedScore + line - opponentScore));
  return unitResultToSettlement(units);
}

export function settleIntentLegFromMatchResult({
  leg,
  matchResult,
  stakeCents,
  odds,
}: {
  leg: ReplayIntentLeg;
  matchResult?: ReplayMatchResult | null;
  stakeCents: number;
  odds: number;
}): ReplaySettlementOutcome {
  if (!matchResult) {
    return { status: "missing_result", reason: "missing linked match result" };
  }
  if (!hasFinalScore(matchResult)) {
    return { status: "pending_result", reason: "match result is not final" };
  }

  try {
    let result: Exclude<SettlementResult, "cashout"> | null = null;
    if (leg.market === "full_time:moneyline") result = settleMoneyline(leg, matchResult);
    if (leg.market === "full_time:correct_score") result = settleCorrectScore(leg, matchResult);
    if (leg.market === "full_time:total") result = settleTotal(leg, matchResult);
    if (leg.market === "full_time:handicap") result = settleHandicap(leg, matchResult);

    if (!result) {
      return { status: "unsupported_market", reason: `unsupported replay market or selection: ${leg.market}` };
    }

    const settlement = calculateSettlement({ result, stakeCents, finalOdds: odds });
    return {
      status: "settled",
      result,
      payoutCents: settlement.payoutCents,
      profitLossCents: settlement.profitLossCents,
    };
  } catch (error) {
    return {
      status: "unsupported_market",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
