export type RiskTier =
  | "normal"
  | "high_confidence"
  | "longshot"
  | "parlay"
  | "parlay_aggressive";

export type BetMode = "single" | "parlay";

export type RiskProfile = {
  singleStakeLimitPct: number;
  highConfidenceStakeLimitPct: number;
  parlayStakeLimitPct: number;
  maxParlayLegs: number;
  dailyLossLimitPct: number;
};

type CheckStakeRiskInput = {
  portfolioBalanceCents: number;
  stakeCents: number;
  riskTier: RiskTier;
  mode: BetMode;
  legsCount: number;
  dailyLossCents: number;
  riskProfile: RiskProfile;
};

type RiskCheckResult = {
  passed: boolean;
  maxAllowedStakeCents: number;
  stakePctOfPortfolio: number;
  dailyLossUsedPct: number;
  reason: string;
};

export function getStakeLimitPct(
  riskTier: RiskTier,
  mode: BetMode,
  riskProfile: RiskProfile,
) {
  if (mode === "parlay") return riskProfile.parlayStakeLimitPct;
  if (riskTier === "high_confidence") return riskProfile.highConfidenceStakeLimitPct;
  return riskProfile.singleStakeLimitPct;
}

export function checkStakeRisk(input: CheckStakeRiskInput): RiskCheckResult {
  const {
    portfolioBalanceCents,
    stakeCents,
    riskTier,
    mode,
    legsCount,
    dailyLossCents,
    riskProfile,
  } = input;

  if (portfolioBalanceCents <= 0) {
    return {
      passed: false,
      maxAllowedStakeCents: 0,
      stakePctOfPortfolio: 0,
      dailyLossUsedPct: 1,
      reason: "portfolio_empty",
    };
  }

  const stakeLimitPct = getStakeLimitPct(riskTier, mode, riskProfile);
  const maxAllowedStakeCents = Math.floor(portfolioBalanceCents * stakeLimitPct);
  const stakePctOfPortfolio = stakeCents / portfolioBalanceCents;
  const dailyLossUsedPct = dailyLossCents / portfolioBalanceCents;

  if (mode === "parlay" && legsCount > riskProfile.maxParlayLegs) {
    return {
      passed: false,
      maxAllowedStakeCents,
      stakePctOfPortfolio,
      dailyLossUsedPct,
      reason: "max_parlay_legs_exceeded",
    };
  }

  if (stakeCents > maxAllowedStakeCents) {
    return {
      passed: false,
      maxAllowedStakeCents,
      stakePctOfPortfolio,
      dailyLossUsedPct,
      reason: "stake_limit_exceeded",
    };
  }

  if (dailyLossUsedPct > riskProfile.dailyLossLimitPct) {
    return {
      passed: false,
      maxAllowedStakeCents,
      stakePctOfPortfolio,
      dailyLossUsedPct,
      reason: "daily_loss_limit_exceeded",
    };
  }

  return {
    passed: true,
    maxAllowedStakeCents,
    stakePctOfPortfolio,
    dailyLossUsedPct,
    reason: "passed",
  };
}
