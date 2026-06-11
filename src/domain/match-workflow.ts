type MatchWorkflowInput = {
  matchStatus: string;
  resultStatus?: string | null;
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
  const matchFinished = input.matchStatus === "finished" || input.resultStatus === "finished";

  if (input.openSlipCount > 0 && matchFinished) {
    return {
      key: "needs_settlement",
      label: "待结算",
      nextAction: "核对平台并结算",
      description: "比赛已有结果且存在未结算 slip。系统只提示，不会自动改钱；你核对平台后再去注单中心写结算。",
    };
  }

  if (input.openSlipCount > 0) {
    return {
      key: "waiting_result",
      label: "等待赛果",
      nextAction: "等待或记录赛果",
      description: "已有未结算 slip，等待 provider score、平台结算或你手动记录赛果；赛果只产生提示，不自动结算。",
    };
  }

  if (input.slipCount > 0) {
    return {
      key: "needs_review",
      label: "待复盘",
      nextAction: "补充复盘",
      description: "这场已有成交和结算记录，可以回看当时盘口、理由、执行质量、盈亏和 User/Codex 表现。",
    };
  }

  if (input.intentCount > 0) {
    return {
      key: "needs_execution",
      label: "待执行",
      nextAction: "处理 intent",
      description: "已有正式下注意图，去决策队列选择执行、继续等待、取消或记录失败；成交前不扣资金。",
    };
  }

  if (input.oddsCount > 0) {
    return {
      key: "needs_analysis",
      label: "待分析",
      nextAction: "生成 Codex dry-run",
      description: "已有真实盘口快照，先看隐含概率、去水和公允赔率，再让 Codex 输出 sources、dataQuality、EV、风险和反方证据。",
    };
  }

  return {
    key: "needs_odds",
    label: "待定价",
    nextAction: "录入真实盘口",
    description: "还没有记录你实际看到的 bookmaker、market、selection、line、odds 和来源时间；先录赔率快照再分析。",
  };
}
