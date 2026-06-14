export function formatActorLabel(actor: string): string {
  switch (actor) {
    case "user":
      return "User";
    case "codex":
      return "Codex";
    case "system":
      return "系统";
    case "importer":
      return "导入器";
    default:
      return actor;
  }
}

export function formatDecisionByLabel(decisionBy: string): string {
  switch (decisionBy) {
    case "user":
      return "User 决策";
    case "codex":
      return "Codex 决策";
    default:
      return decisionBy;
  }
}

export function formatBetModeLabel(mode: string): string {
  switch (mode) {
    case "single":
      return "单场";
    case "parlay":
      return "串关";
    default:
      return mode;
  }
}

export function formatIntentStatus(status: string): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "proposed":
      return "待执行";
    case "approved":
      return "已批准";
    case "executed":
      return "已成交";
    case "cancelled":
      return "已取消";
    case "expired":
      return "已过期";
    default:
      return status;
  }
}

export function formatRiskTierLabel(riskTier: string): string {
  switch (riskTier) {
    case "normal":
      return "普通单场";
    case "high_confidence":
      return "高信心";
    case "small_test":
      return "小额测试";
    case "speculative":
      return "试探单";
    case "longshot":
      return "冷门/高赔";
    case "parlay":
      return "串关";
    case "parlay_aggressive":
      return "激进串关";
    default:
      return riskTier;
  }
}

export function formatBetSlipStatus(status: string): string {
  switch (status) {
    case "open":
      return "未结算";
    case "won":
      return "赢";
    case "lost":
      return "输";
    case "void":
      return "走水";
    case "half_won":
      return "半赢";
    case "half_lost":
      return "半输";
    case "cashout":
      return "提前兑现";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}
