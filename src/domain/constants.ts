export const ACTORS = ["user", "codex", "system", "importer"] as const;
export const PORTFOLIOS = ["user", "codex"] as const;

export const DEFAULT_CURRENCY = "CNY";
export const DEFAULT_CODEX_ALLOCATION_CENTS = 100_000;
export const DEFAULT_ODDS_TOLERANCE = 0.06;

export const DEFAULT_CODEX_RISK_PROFILE = {
  singleStakeLimitPct: 0.1,
  highConfidenceStakeLimitPct: 0.2,
  parlayStakeLimitPct: 0.05,
  maxParlayLegs: 7,
  dailyLossLimitPct: 0.4,
} as const;
