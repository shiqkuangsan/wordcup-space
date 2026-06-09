export function getOddsChangePct(intendedOdds: number, observedOdds: number) {
  if (intendedOdds <= 0) {
    throw new Error("intendedOdds must be greater than 0");
  }

  return Math.abs(observedOdds - intendedOdds) / intendedOdds;
}

export function isWithinOddsTolerance(
  intendedOdds: number,
  observedOdds: number,
  tolerance = 0.06,
) {
  return getOddsChangePct(intendedOdds, observedOdds) < tolerance;
}
