export type BetPeriod = "full_time" | "half_time" | "first_half";

export type MarketType =
  | "moneyline"
  | "correct_score"
  | "handicap"
  | "total"
  | "total_goals"
  | "total_goals_range"
  | "double_chance"
  | "nth_goal"
  | "highest_scoring_half"
  | "both_teams_to_score"
  | "win_and_btts"
  | "parlay";

export const BET_PERIOD_OPTIONS: Array<{ value: BetPeriod; label: string }> = [
  { value: "full_time", label: "全场" },
  { value: "half_time", label: "半场" },
  { value: "first_half", label: "上半场" },
];

export const MARKET_TYPE_OPTIONS: Array<{ value: MarketType; label: string; needsLine: boolean }> = [
  { value: "moneyline", label: "胜平负", needsLine: false },
  { value: "correct_score", label: "比分", needsLine: false },
  { value: "handicap", label: "让球", needsLine: true },
  { value: "total", label: "大小球", needsLine: true },
  { value: "total_goals", label: "总进球", needsLine: true },
  { value: "total_goals_range", label: "总进球范围", needsLine: false },
  { value: "double_chance", label: "双重机会", needsLine: false },
  { value: "nth_goal", label: "第 N 个进球球队", needsLine: true },
  { value: "highest_scoring_half", label: "进球最多的半场", needsLine: false },
  { value: "both_teams_to_score", label: "双方进球", needsLine: false },
  { value: "win_and_btts", label: "胜负 + 双方进球", needsLine: false },
  { value: "parlay", label: "串关", needsLine: false },
];

export function formatMarketLabel(market: string) {
  const [period, marketType] = market.split(":");
  const marketLabel = MARKET_TYPE_OPTIONS.find((option) => option.value === marketType || option.value === market)?.label;

  if (marketLabel && period && marketType) {
    const periodLabel = BET_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? period;
    return `${periodLabel}：${marketLabel}`;
  }

  return marketLabel ?? market;
}
