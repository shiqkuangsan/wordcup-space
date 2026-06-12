type ExecutionAttemptLike = {
  status: string;
  oddsChangePct?: number | null;
  oddsTolerancePct?: number | null;
};

type BetSlipLike = {
  status: string;
};

type BetIntentLike = {
  status: string;
  expiresAt?: string | null;
};

export function canCreateBetSlip(attempt: ExecutionAttemptLike) {
  if (attempt.status !== "succeeded") return false;
  if (
    attempt.oddsChangePct != null &&
    attempt.oddsTolerancePct != null &&
    attempt.oddsChangePct >= attempt.oddsTolerancePct
  ) {
    return false;
  }

  return true;
}

export function canSettleBetSlip(betSlip: BetSlipLike) {
  return betSlip.status === "open";
}

export function canExpireIntent(intent: BetIntentLike, now = new Date()) {
  if (!["draft", "proposed", "approved"].includes(intent.status)) return false;
  if (!intent.expiresAt) return false;
  return new Date(intent.expiresAt).getTime() <= now.getTime();
}

export function isIntentTerminal(status: string) {
  return ["executed", "cancelled", "expired"].includes(status);
}

export function isIntentExecutable(intent: BetIntentLike, now = new Date()) {
  return !isIntentTerminal(intent.status) && !canExpireIntent(intent, now);
}

export function getEffectiveIntentStatus(intent: BetIntentLike, now = new Date()) {
  return canExpireIntent(intent, now) ? "expired" : intent.status;
}
