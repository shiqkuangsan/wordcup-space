import { describe, expect, it } from "vitest";
import { getMatchWorkflowStatus } from "@/domain/match-workflow";

describe("match workflow status", () => {
  it("asks for odds before analysis when no odds exist", () => {
    expect(getMatchWorkflowStatus({ matchStatus: "scheduled", oddsCount: 0, intentCount: 0, slipCount: 0, openSlipCount: 0 })).toMatchObject({
      key: "needs_odds",
      nextAction: "录入真实盘口",
    });
  });

  it("moves from priced match to analysis", () => {
    expect(getMatchWorkflowStatus({ matchStatus: "scheduled", oddsCount: 2, intentCount: 0, slipCount: 0, openSlipCount: 0 })).toMatchObject({
      key: "needs_analysis",
      nextAction: "生成 Codex dry-run",
    });
  });

  it("asks for execution when an intent exists without slips", () => {
    expect(getMatchWorkflowStatus({ matchStatus: "scheduled", oddsCount: 2, intentCount: 1, slipCount: 0, openSlipCount: 0 })).toMatchObject({
      key: "needs_execution",
      nextAction: "处理 intent",
    });
  });

  it("asks for settlement only after a match finishes with open slips", () => {
    expect(getMatchWorkflowStatus({ matchStatus: "finished", oddsCount: 2, intentCount: 1, slipCount: 1, openSlipCount: 1 })).toMatchObject({
      key: "needs_settlement",
      nextAction: "核对平台并结算",
    });
  });

  it("uses provider or manual result status to surface settlement prompts", () => {
    expect(
      getMatchWorkflowStatus({
        matchStatus: "scheduled",
        resultStatus: "finished",
        oddsCount: 2,
        intentCount: 1,
        slipCount: 1,
        openSlipCount: 1,
      }),
    ).toMatchObject({
      key: "needs_settlement",
      nextAction: "核对平台并结算",
    });
  });
});
