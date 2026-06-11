type MatchWorkflowInput = {
  matchStatus: string;
  oddsCount: number;
  intentCount: number;
  slipCount: number;
  openSlipCount: number;
};

export type MatchWorkflowStatus = {
  key:
    | "needs_odds"
    | "needs_analysis"
    | "needs_execution"
    | "waiting_result"
    | "needs_settlement"
    | "needs_review";
  label: string;
  nextAction: string;
  description: string;
};

export function getMatchWorkflowStatus(input: MatchWorkflowInput): MatchWorkflowStatus {
  if (input.openSlipCount > 0 && input.matchStatus === "finished") {
    return {
      key: "needs_settlement",
      label: "待结算",
      nextAction: "记录结算",
      description: "比赛已完结且存在未结算注单，先核对平台结算再写入资金结果。",
    };
  }

  if (input.openSlipCount > 0) {
    return {
      key: "waiting_result",
      label: "等待赛果",
      nextAction: "等待结算",
      description: "已有未结算注单，等待比赛结果或平台结算。",
    };
  }

  if (input.slipCount > 0) {
    return {
      key: "needs_review",
      label: "待复盘",
      nextAction: "补充复盘",
      description: "这场已有注单记录，可以补充赛后判断质量和盘口复盘。",
    };
  }

  if (input.intentCount > 0) {
    return {
      key: "needs_execution",
      label: "待执行",
      nextAction: "执行或放弃",
      description: "已有下注意图，下一步是确认是否执行、失败还是取消。",
    };
  }

  if (input.oddsCount > 0) {
    return {
      key: "needs_analysis",
      label: "待分析",
      nextAction: "生成分析",
      description: "已有盘口快照，可以让 Codex 评估概率、EV 和风险。",
    };
  }

  return {
    key: "needs_odds",
    label: "待定价",
    nextAction: "录入盘口",
    description: "还没有记录你实际看到的盘口，先录赔率快照再分析。",
  };
}
