export type BetPeriod = "full_time" | "half_time";

export type MarketType =
  | "moneyline"
  | "handicap"
  | "total"
  | "nth_goal"
  | "highest_scoring_half"
  | "parlay";

export const BET_PERIOD_OPTIONS: Array<{ value: BetPeriod; label: string }> = [
  { value: "full_time", label: "全场" },
  { value: "half_time", label: "半场" },
];

export const MARKET_TYPE_OPTIONS: Array<{ value: MarketType; label: string; needsLine: boolean }> = [
  { value: "moneyline", label: "胜平负", needsLine: false },
  { value: "handicap", label: "让球", needsLine: true },
  { value: "total", label: "大小球", needsLine: true },
  { value: "nth_goal", label: "第 N 个进球球队", needsLine: true },
  { value: "highest_scoring_half", label: "进球最多的半场", needsLine: false },
  { value: "parlay", label: "串关", needsLine: false },
];

export function formatMarketLabel(market: string) {
  return MARKET_TYPE_OPTIONS.find((option) => option.value === market)?.label ?? market;
}
