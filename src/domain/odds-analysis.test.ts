import { describe, expect, it } from "vitest";
import {
  analyzeOddsSnapshot,
  calculateExpectedValue,
  devigMarketProbabilities,
  impliedProbabilityFromDecimalOdds,
} from "@/domain/odds-analysis";

describe("odds analysis", () => {
  it("converts decimal odds into implied probability and break-even probability", () => {
    expect(impliedProbabilityFromDecimalOdds(2)).toBe(0.5);
    expect(analyzeOddsSnapshot({ decimalOdds: 1.9 })).toMatchObject({
      impliedProbability: 0.5263157894736842,
      breakEvenProbability: 0.5263157894736842,
    });
  });

  it("devigs a 1X2 market into normalized fair probabilities", () => {
    const result = devigMarketProbabilities([
      { id: "home", decimalOdds: 2 },
      { id: "draw", decimalOdds: 3.5 },
      { id: "away", decimalOdds: 4 },
    ]);

    expect(result.overround).toBeCloseTo(0.035714);
    expect(result.outcomes.map((outcome) => outcome.id)).toEqual(["home", "draw", "away"]);
    expect(result.outcomes[0]?.fairProbability).toBeCloseTo(0.482759);
    expect(result.outcomes[1]?.fairProbability).toBeCloseTo(0.275862);
    expect(result.outcomes[2]?.fairProbability).toBeCloseTo(0.241379);
    expect(result.outcomes.reduce((sum, outcome) => sum + outcome.fairProbability, 0)).toBeCloseTo(1);
  });

  it("calculates EV per unit stake from model probability and odds", () => {
    expect(calculateExpectedValue({ modelProbability: 0.55, decimalOdds: 2 })).toBeCloseTo(0.1);
    expect(calculateExpectedValue({ modelProbability: 0.5, decimalOdds: 1.9 })).toBeCloseTo(-0.05);
  });
});
