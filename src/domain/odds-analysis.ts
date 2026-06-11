export type OddsAnalysisOutcome = {
  id: string;
  decimalOdds: number;
  impliedProbability: number;
  fairProbability: number;
  fairOdds: number;
};

export type DevigResult = {
  totalImpliedProbability: number;
  overround: number;
  outcomes: OddsAnalysisOutcome[];
};

export function impliedProbabilityFromDecimalOdds(decimalOdds: number): number {
  assertPositiveOdds(decimalOdds);
  return 1 / decimalOdds;
}

export function fairOddsFromProbability(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
    throw new Error("probability must be greater than 0 and at most 1");
  }

  return 1 / probability;
}

export function analyzeOddsSnapshot({ decimalOdds }: { decimalOdds: number }) {
  const impliedProbability = impliedProbabilityFromDecimalOdds(decimalOdds);
  return {
    decimalOdds,
    impliedProbability,
    breakEvenProbability: impliedProbability,
  };
}

export function devigMarketProbabilities(
  outcomes: Array<{ id: string; decimalOdds: number }>,
): DevigResult {
  if (outcomes.length < 2) {
    throw new Error("at least two outcomes are required to devig a market");
  }

  const implied = outcomes.map((outcome) => ({
    ...outcome,
    impliedProbability: impliedProbabilityFromDecimalOdds(outcome.decimalOdds),
  }));
  const totalImpliedProbability = implied.reduce((sum, outcome) => sum + outcome.impliedProbability, 0);

  if (totalImpliedProbability <= 0) {
    throw new Error("total implied probability must be positive");
  }

  return {
    totalImpliedProbability,
    overround: totalImpliedProbability - 1,
    outcomes: implied.map((outcome) => {
      const fairProbability = outcome.impliedProbability / totalImpliedProbability;
      return {
        ...outcome,
        fairProbability,
        fairOdds: fairOddsFromProbability(fairProbability),
      };
    }),
  };
}

export function calculateExpectedValue({
  modelProbability,
  decimalOdds,
}: {
  modelProbability: number;
  decimalOdds: number;
}): number {
  assertPositiveOdds(decimalOdds);
  if (!Number.isFinite(modelProbability) || modelProbability < 0 || modelProbability > 1) {
    throw new Error("modelProbability must be between 0 and 1");
  }

  return modelProbability * decimalOdds - 1;
}

function assertPositiveOdds(decimalOdds: number) {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error("decimalOdds must be greater than 1");
  }
}
