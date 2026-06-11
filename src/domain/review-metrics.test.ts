import { describe, expect, it } from "vitest";
import { summarizeReviewByDecision } from "@/domain/review-metrics";

describe("review metrics", () => {
  it("summarizes ROI, hit rate, exposure and odds drift by decision actor", () => {
    const [codex, user] = summarizeReviewByDecision([
      {
        decisionBy: "codex",
        status: "won",
        stakeCents: 1000,
        finalOdds: 2,
        profitLossCents: 1000,
        oddsChangePct: 0.01,
      },
      {
        decisionBy: "codex",
        status: "lost",
        stakeCents: 1000,
        finalOdds: 1.8,
        profitLossCents: -1000,
        oddsChangePct: -0.02,
      },
      {
        decisionBy: "user",
        status: "open",
        stakeCents: 500,
        finalOdds: 3,
      },
    ]);

    expect(codex.decisionBy).toBe("codex");
    expect(codex.settledCount).toBe(2);
    expect(codex.hitRate).toBe(0.5);
    expect(codex.roi).toBe(0);
    expect(codex.averageOdds).toBeCloseTo(1.9);
    expect(codex.averageOddsChangePct).toBeCloseTo(-0.005);
    expect(user.openExposureCents).toBe(500);
    expect(user.roi).toBeNull();
  });
});
