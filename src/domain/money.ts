export function toCents(amount: number) {
  return Math.round(amount * 100);
}

export function fromCents(cents: number) {
  return cents / 100;
}

export function formatCny(cents: number) {
  return fromCents(cents).toFixed(2);
}

export function getPotentialReturnCents(stakeCents: number, decimalOdds: number) {
  return Math.round(stakeCents * decimalOdds);
}
