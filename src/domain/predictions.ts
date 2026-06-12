export type MatchOutcome = "home_win" | "draw" | "away_win";

export function getScoreOutcome(homeScore: number, awayScore: number): MatchOutcome {
  if (homeScore > awayScore) return "home_win";
  if (homeScore < awayScore) return "away_win";
  return "draw";
}

export function formatPredictionOutcome(outcome: string) {
  if (outcome === "home_win") return "主胜";
  if (outcome === "away_win") return "客胜";
  if (outcome === "draw") return "平局";
  return outcome;
}

export function formatPredictionConfidence(confidence: string) {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  if (confidence === "low") return "低";
  return confidence;
}

export function formatPredictionStatus(status: string) {
  if (status === "predicted") return "已预测";
  if (status === "settled") return "已核对";
  if (status === "void") return "无效";
  return status;
}

export function formatPredictionDataMode(dataMode: string) {
  if (dataMode === "offline") return "不联网";
  if (dataMode === "prior_analysis") return "基于前序分析";
  if (dataMode === "live_research") return "联网调查";
  return dataMode;
}
