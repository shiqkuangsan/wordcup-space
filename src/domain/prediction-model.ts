import type { MatchOutcome } from "@/domain/predictions";

export const SCORELINE_MODEL_VERSION = "scoreline-poisson-2026.1";

const AVERAGE_GOALS = 2.6;
const HOME_ADVANTAGE_GOALS = 0.22;
const RATING_POINTS_PER_GOAL = 180;
const GOAL_SUPREMACY_CAP = 2.2;
const MIN_EXPECTED_GOALS = 0.25;
const MAX_GOALS = 8;
const MATCH_SHOCK_SD = 0.35;
const PROBABILITY_SHRINK = 0.14;
const NEUTRAL_OUTCOME = {
  home_win: 0.36,
  draw: 0.28,
  away_win: 0.36,
} satisfies Record<MatchOutcome, number>;

const SHOCK_POINTS = [
  { z: -2, weight: 0.0545 },
  { z: -1, weight: 0.2442 },
  { z: 0, weight: 0.4026 },
  { z: 1, weight: 0.2442 },
  { z: 2, weight: 0.0545 },
] as const;

export type PredictionModelTeam = {
  name: string;
  rating: number;
  host?: boolean;
};

export type PredictionModelInput = {
  home: PredictionModelTeam;
  away: PredictionModelTeam;
  neutral?: boolean;
  knockout?: boolean;
  homeGoalAdjustment?: number;
  awayGoalAdjustment?: number;
};

export type ScoreProbability = {
  homeScore: number;
  awayScore: number;
  probability: number;
};

export type PredictionModelSnapshot = {
  modelVersion: string;
  expectedGoals: {
    home: number;
    away: number;
  };
  probabilities: Record<MatchOutcome, number>;
  mainPrediction: {
    outcome: MatchOutcome;
    homeScore: number;
    awayScore: number;
    scoreProbability: number;
  };
  modalScore: ScoreProbability;
  scoreDistribution: ScoreProbability[];
  reasons: string[];
};

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function poisson(k: number, lambda: number) {
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return Math.exp(-lambda) * lambda ** k / factorial;
}

function roundProbability(value: number) {
  return Number(value.toFixed(6));
}

function roundGoals(value: number) {
  return Number(value.toFixed(4));
}

export function getDirectionalScore(distribution: ScoreProbability[], outcome: MatchOutcome) {
  const match = distribution.find((score) => {
    if (outcome === "home_win") return score.homeScore > score.awayScore;
    if (outcome === "away_win") return score.homeScore < score.awayScore;
    return score.homeScore === score.awayScore;
  });

  return match ?? distribution[0];
}

export function calculateExpectedGoals(input: PredictionModelInput) {
  const supremacy = clamp(
    (input.home.rating - input.away.rating) / RATING_POINTS_PER_GOAL,
    -GOAL_SUPREMACY_CAP,
    GOAL_SUPREMACY_CAP,
  );
  const homeAdvantage = input.neutral || !input.home.host ? 0 : HOME_ADVANTAGE_GOALS;
  const awayAdvantage = input.neutral || !input.away.host ? 0 : HOME_ADVANTAGE_GOALS;
  const knockoutMultiplier = input.knockout ? 0.92 : 1;
  const home =
    (AVERAGE_GOALS / 2 + supremacy / 2 + homeAdvantage + (input.homeGoalAdjustment ?? 0)) * knockoutMultiplier;
  const away =
    (AVERAGE_GOALS / 2 - supremacy / 2 + awayAdvantage + (input.awayGoalAdjustment ?? 0)) * knockoutMultiplier;

  return {
    home: Math.max(MIN_EXPECTED_GOALS, home),
    away: Math.max(MIN_EXPECTED_GOALS, away),
  };
}

export function buildScorelineModel(input: PredictionModelInput): PredictionModelSnapshot {
  const expectedGoals = calculateExpectedGoals(input);
  const scoreMap = new Map<string, ScoreProbability>();
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (const shock of SHOCK_POINTS) {
    const homeLambda = Math.max(MIN_EXPECTED_GOALS, expectedGoals.home + (shock.z * MATCH_SHOCK_SD) / 2);
    const awayLambda = Math.max(MIN_EXPECTED_GOALS, expectedGoals.away - (shock.z * MATCH_SHOCK_SD) / 2);

    for (let homeScore = 0; homeScore <= MAX_GOALS; homeScore += 1) {
      for (let awayScore = 0; awayScore <= MAX_GOALS; awayScore += 1) {
        const probability = shock.weight * poisson(homeScore, homeLambda) * poisson(awayScore, awayLambda);
        const key = `${homeScore}:${awayScore}`;
        const existing = scoreMap.get(key);
        if (existing) {
          existing.probability += probability;
        } else {
          scoreMap.set(key, { homeScore, awayScore, probability });
        }

        if (homeScore > awayScore) homeWin += probability;
        else if (homeScore < awayScore) awayWin += probability;
        else draw += probability;
      }
    }
  }

  const total = Array.from(scoreMap.values()).reduce((sum, score) => sum + score.probability, 0);
  const rawProbabilities = {
    home_win: homeWin / total,
    draw: draw / total,
    away_win: awayWin / total,
  } satisfies Record<MatchOutcome, number>;
  const probabilities = {
    home_win: roundProbability(rawProbabilities.home_win * (1 - PROBABILITY_SHRINK) + NEUTRAL_OUTCOME.home_win * PROBABILITY_SHRINK),
    draw: roundProbability(rawProbabilities.draw * (1 - PROBABILITY_SHRINK) + NEUTRAL_OUTCOME.draw * PROBABILITY_SHRINK),
    away_win: roundProbability(rawProbabilities.away_win * (1 - PROBABILITY_SHRINK) + NEUTRAL_OUTCOME.away_win * PROBABILITY_SHRINK),
  } satisfies Record<MatchOutcome, number>;
  const mainOutcome = (Object.entries(probabilities) as Array<[MatchOutcome, number]>)
    .sort((left, right) => right[1] - left[1])[0][0];
  const scoreDistribution = Array.from(scoreMap.values())
    .map((score) => ({ ...score, probability: roundProbability(score.probability / total) }))
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 10);
  const modalScore = scoreDistribution[0];
  const mainScore = getDirectionalScore(scoreDistribution, mainOutcome);
  const stronger =
    Math.abs(input.home.rating - input.away.rating) < 25
      ? null
      : input.home.rating > input.away.rating
        ? input.home.name
        : input.away.name;

  return {
    modelVersion: SCORELINE_MODEL_VERSION,
    expectedGoals: {
      home: roundGoals(expectedGoals.home),
      away: roundGoals(expectedGoals.away),
    },
    probabilities,
    mainPrediction: {
      outcome: mainOutcome,
      homeScore: mainScore.homeScore,
      awayScore: mainScore.awayScore,
      scoreProbability: mainScore.probability,
    },
    modalScore,
    scoreDistribution,
    reasons: [
      stronger
        ? `${stronger} has the stronger pre-match rating baseline.`
        : "The pre-match rating baseline is close enough to avoid a strong side bias.",
      `Expected goals are ${roundGoals(expectedGoals.home)}-${roundGoals(expectedGoals.away)} before scoreline sampling.`,
      "The headline outcome uses the highest win/draw/loss probability, and the main score is forced to match that outcome direction.",
      "Single-match football variance is represented with a Poisson score matrix, shock mixture, and probability shrink toward a neutral baseline.",
    ],
  };
}
