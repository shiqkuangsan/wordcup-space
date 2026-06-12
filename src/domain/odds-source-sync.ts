import { z } from "zod";

export const syncedOddsBookmakerSchema = z.enum(["DraftKings", "bet365", "Betway"]);
export type SyncedOddsBookmaker = z.infer<typeof syncedOddsBookmakerSchema>;

export type SyncedOddsSelection = {
  selection: string;
  decimalOdds: number;
};

export type SyncedOddsMarket = {
  bookmaker: SyncedOddsBookmaker;
  market: "full_time:moneyline";
  selections: SyncedOddsSelection[];
  capturedAt: string;
  sourceUrl: string;
  sourceLabel: string;
};

export function americanToDecimalOdds(value: number) {
  if (value === 0) throw new Error("american odds cannot be 0");
  return value > 0 ? 1 + value / 100 : 1 + 100 / Math.abs(value);
}

export function fractionalToDecimalOdds(value: string) {
  const match = value.trim().match(/^(\d+)\s*[-/]\s*(\d+)$/);
  if (!match) throw new Error(`invalid fractional odds: ${value}`);

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (denominator <= 0) throw new Error(`invalid fractional odds: ${value}`);

  return 1 + numerator / denominator;
}

export function roundDecimalOdds(value: number) {
  return Math.round(value * 100) / 100;
}
