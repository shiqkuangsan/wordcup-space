import { describe, expect, it } from "vitest";
import { DEFAULT_CODEX_RISK_PROFILE } from "@/domain/constants";
import { checkStakeRisk } from "@/domain/risk";

const balance = 100000;

describe("risk", () => {
  it("allows normal singles at 10 percent and blocks above it", () => {
    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 10000,
        riskTier: "normal",
        mode: "single",
        legsCount: 1,
        dailyLossCents: 0,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).passed,
    ).toBe(true);

    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 10001,
        riskTier: "normal",
        mode: "single",
        legsCount: 1,
        dailyLossCents: 0,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).reason,
    ).toBe("stake_limit_exceeded");
  });

  it("allows high confidence singles at 20 percent and blocks above it", () => {
    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 20000,
        riskTier: "high_confidence",
        mode: "single",
        legsCount: 1,
        dailyLossCents: 0,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).passed,
    ).toBe(true);

    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 20001,
        riskTier: "high_confidence",
        mode: "single",
        legsCount: 1,
        dailyLossCents: 0,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).reason,
    ).toBe("stake_limit_exceeded");
  });

  it("allows parlays at 5 percent and blocks above it", () => {
    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 5000,
        riskTier: "parlay",
        mode: "parlay",
        legsCount: 7,
        dailyLossCents: 0,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).passed,
    ).toBe(true);

    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 5001,
        riskTier: "parlay",
        mode: "parlay",
        legsCount: 7,
        dailyLossCents: 0,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).reason,
    ).toBe("stake_limit_exceeded");
  });

  it("blocks parlays above seven legs", () => {
    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 100,
        riskTier: "parlay",
        mode: "parlay",
        legsCount: 8,
        dailyLossCents: 0,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).reason,
    ).toBe("max_parlay_legs_exceeded");
  });

  it("blocks daily loss above 40 percent", () => {
    expect(
      checkStakeRisk({
        portfolioBalanceCents: balance,
        stakeCents: 100,
        riskTier: "normal",
        mode: "single",
        legsCount: 1,
        dailyLossCents: 40001,
        riskProfile: DEFAULT_CODEX_RISK_PROFILE,
      }).reason,
    ).toBe("daily_loss_limit_exceeded");
  });
});
