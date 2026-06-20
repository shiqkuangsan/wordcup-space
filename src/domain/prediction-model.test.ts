import { describe, expect, it } from "vitest";
import { buildScorelineModel, calculateExpectedGoals, getDirectionalScore } from "@/domain/prediction-model";

describe("prediction model", () => {
  it("builds a deterministic favorite scoreline model", () => {
    const model = buildScorelineModel({
      home: { name: "Portugal", rating: 1990 },
      away: { name: "Congo DR", rating: 1680 },
    });

    expect(model.modelVersion).toBe("scoreline-poisson-2026.1");
    expect(model.expectedGoals.home).toBeCloseTo(2.1611, 4);
    expect(model.expectedGoals.away).toBeCloseTo(0.4389, 4);
    expect(model.probabilities.home_win).toBeGreaterThan(model.probabilities.draw);
    expect(model.probabilities.home_win).toBeGreaterThan(model.probabilities.away_win);
    expect(model.mainPrediction).toMatchObject({
      outcome: "home_win",
      homeScore: 2,
      awayScore: 0,
    });
    expect(model.scoreDistribution).toHaveLength(10);
  });

  it("keeps the main score aligned with the headline outcome", () => {
    const model = buildScorelineModel({
      home: { name: "Underdog", rating: 1650 },
      away: { name: "Favorite", rating: 1960 },
    });

    expect(model.mainPrediction.outcome).toBe("away_win");
    expect(model.mainPrediction.homeScore).toBeLessThan(model.mainPrediction.awayScore);
  });

  it("finds the first score matching a requested outcome direction", () => {
    const score = getDirectionalScore(
      [
        { homeScore: 1, awayScore: 1, probability: 0.2 },
        { homeScore: 1, awayScore: 0, probability: 0.18 },
        { homeScore: 0, awayScore: 1, probability: 0.17 },
      ],
      "home_win",
    );

    expect(score).toEqual({ homeScore: 1, awayScore: 0, probability: 0.18 });
  });

  it("applies host advantage, neutral mode, knockout tempo, and goal clamps", () => {
    const host = calculateExpectedGoals({
      home: { name: "Mexico", rating: 1810, host: true },
      away: { name: "Canada", rating: 1720 },
    });
    const neutral = calculateExpectedGoals({
      home: { name: "Mexico", rating: 1810, host: true },
      away: { name: "Canada", rating: 1720 },
      neutral: true,
    });
    const knockout = calculateExpectedGoals({
      home: { name: "Mexico", rating: 1810, host: true },
      away: { name: "Canada", rating: 1720 },
      knockout: true,
    });
    const clamped = calculateExpectedGoals({
      home: { name: "Tiny", rating: 1200, host: false, },
      away: { name: "Giant", rating: 2200 },
      homeGoalAdjustment: -1,
    });

    expect(host.home).toBeGreaterThan(neutral.home);
    expect(knockout.home + knockout.away).toBeLessThan(host.home + host.away);
    expect(clamped.home).toBe(0.25);
  });
});
