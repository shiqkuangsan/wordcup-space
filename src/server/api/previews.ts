import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betIntents, betSlips, portfolios } from "@/db/schema";
import { canCreateBetSlip, canSettleBetSlip } from "@/domain/bet-lifecycle";
import { getNextBalanceCents } from "@/domain/ledger";
import { getPotentialReturnCents } from "@/domain/money";
import { getOddsChangePct, normalizeOddsFormat, toDecimalOdds } from "@/domain/odds";
import { calculateSettlement, SETTLEMENT_RESULT_OPTIONS, type SettlementResult } from "@/domain/settlement";

type IntentLegInput = {
  matchId: string;
  market: string;
  selection: string;
  line?: string;
  intendedOdds: number;
  legOrder?: number;
  notes?: string;
};

type PreviewBody = Record<string, unknown>;

export function isDryRunRequest(body: PreviewBody) {
  return body.dryRun === true || body.preview === true;
}

function stakeCentsFromBody(body: PreviewBody) {
  const stakeCents =
    typeof body.stakeCents === "number"
      ? body.stakeCents
      : Math.round(Number(body.stake) * 100);

  if (!Number.isFinite(stakeCents) || stakeCents <= 0) {
    throw new Error("stake/stakeCents must be a positive number");
  }

  return stakeCents;
}

export function buildIntentPreview(body: PreviewBody & { legs?: IntentLegInput[] }) {
  const legs = Array.isArray(body.legs) ? body.legs : [];
  const intendedStakeCents = stakeCentsFromBody(body);
  const intendedTotalOdds = Number(body.intendedTotalOdds ?? body.odds);

  if (!Number.isFinite(intendedTotalOdds) || intendedTotalOdds <= 0) {
    throw new Error("odds/intendedTotalOdds must be a positive number");
  }

  const warnings: string[] = [];
  const mode = String(body.mode);

  if (mode === "single" && legs.length > 1) {
    warnings.push("单场模式收到多条 legs，请确认是否应改为串关。");
  }

  if (mode === "parlay" && legs.length > 7) {
    warnings.push("串关 legs 超过 7，当前风控不允许。");
  }

  if (legs.length === 0) {
    warnings.push("未绑定比赛 leg，成交和复盘会缺少比赛上下文。");
  }

  return {
    dryRun: true,
    writes: false,
    intent: {
      portfolioId: String(body.portfolioId),
      decisionBy: String(body.decisionBy),
      mode,
      market: typeof body.market === "string" ? body.market : undefined,
      intendedStakeCents,
      intendedTotalOdds,
      riskTier: String(body.riskTier),
      confidence: String(body.confidence),
      modelProbability: typeof body.modelProbability === "number" ? body.modelProbability : undefined,
      expectedValue: typeof body.expectedValue === "number" ? body.expectedValue : undefined,
      status: typeof body.status === "string" ? body.status : "proposed",
      approvalMode: typeof body.approvalMode === "string" ? body.approvalMode : "auto",
      rationale: String(body.rationale),
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
    },
    legs: legs.map((leg, index) => ({
      ...leg,
      legOrder: leg.legOrder ?? index + 1,
    })),
    warnings,
  };
}

export function buildBetSlipPreview(body: PreviewBody) {
  const db = getDb();
  const betIntentId = String(body.betIntentId || "");
  const intent = db.select().from(betIntents).where(eq(betIntents.id, betIntentId)).get();

  if (!intent) throw new Error(`bet intent not found: ${betIntentId}`);

  const portfolio = db.select().from(portfolios).where(eq(portfolios.id, intent.portfolioId)).get();
  if (!portfolio) throw new Error(`portfolio not found: ${intent.portfolioId}`);

  const stakeCents = stakeCentsFromBody(body);
  const oddsFormat = normalizeOddsFormat(body.oddsFormat);
  const rawOdds = Number(body.rawOdds ?? body.finalOdds);
  const finalOdds = toDecimalOdds(rawOdds, oddsFormat);
  const rawObservedOdds = body.rawObservedOdds ?? body.observedOdds ?? rawOdds;
  const intendedOdds = Number(body.intendedOdds ?? intent.intendedTotalOdds);
  const observedOdds = toDecimalOdds(Number(rawObservedOdds), oddsFormat);

  if (!Number.isFinite(finalOdds) || finalOdds <= 0) throw new Error("finalOdds must be a positive number");
  if (!Number.isFinite(intendedOdds) || intendedOdds <= 0) throw new Error("intendedOdds must be a positive number");
  if (!Number.isFinite(observedOdds) || observedOdds <= 0) throw new Error("observedOdds must be a positive number");

  const oddsTolerancePct =
    typeof body.oddsTolerancePct === "number" ? body.oddsTolerancePct : 0.06;
  const oddsChangePct = getOddsChangePct(intendedOdds, observedOdds);
  const canCreate = canCreateBetSlip({
    status: "succeeded",
    oddsChangePct,
    oddsTolerancePct,
  });
  const balanceAfterCents = getNextBalanceCents({
    currentBalanceCents: portfolio.allocatedBalanceCents,
    entryType: "stake_paid",
    amountCents: stakeCents,
  });
  const warnings: string[] = [];

  if (!canCreate) warnings.push("最终赔率变化达到或超过容忍区间，需要重新复核。");
  if (balanceAfterCents < 0) warnings.push("余额不足，不能生成真实成交注单。");

  return {
    dryRun: true,
    writes: false,
    canCreate: canCreate && balanceAfterCents >= 0,
    attempt: {
      betIntentId,
      executionMethod: String(body.executionMethod ?? "user_manual"),
      platformAccountId: String(body.platformAccountId || ""),
      intendedOdds,
      observedOdds,
      oddsFormat,
      rawObservedOdds: Number(rawObservedOdds),
      oddsChangePct,
      oddsTolerancePct,
    },
    slip: {
      portfolioId: intent.portfolioId,
      decisionBy: intent.decisionBy,
      mode: intent.mode,
      stakeCents,
      finalOdds,
      oddsFormat,
      rawOdds,
      potentialReturnCents: getPotentialReturnCents(stakeCents, finalOdds),
      isRealMoney: body.isRealMoney !== false,
      confirmationRef: typeof body.confirmationRef === "string" ? body.confirmationRef : undefined,
      balanceAfterCents,
    },
    warnings,
  };
}

export function buildSettlementPreview(body: PreviewBody) {
  const db = getDb();
  const betSlipId = String(body.betSlipId || "");
  const slip = db.select().from(betSlips).where(eq(betSlips.id, betSlipId)).get();

  if (!slip) throw new Error(`bet slip not found: ${betSlipId}`);
  if (!canSettleBetSlip(slip)) throw new Error("bet slip cannot be settled");

  const portfolio = db.select().from(portfolios).where(eq(portfolios.id, slip.portfolioId)).get();
  if (!portfolio) throw new Error(`portfolio not found: ${slip.portfolioId}`);

  const result = String(body.result) as SettlementResult;
  if (!SETTLEMENT_RESULT_OPTIONS.some((option) => option.value === result)) {
    throw new Error("unsupported settlement result");
  }

  const cashoutAmountCents =
    typeof body.cashoutAmountCents === "number"
      ? body.cashoutAmountCents
      : body.cashoutAmount
        ? Math.round(Number(body.cashoutAmount) * 100)
        : undefined;
  if (result === "cashout" && cashoutAmountCents === undefined) {
    throw new Error("cashout settlement requires cashoutAmountCents");
  }
  if (cashoutAmountCents !== undefined && (!Number.isFinite(cashoutAmountCents) || cashoutAmountCents < 0)) {
    throw new Error("cashoutAmountCents must be a non-negative number");
  }

  const settlementCalc = calculateSettlement({
    result,
    stakeCents: slip.stakeCents,
    finalOdds: slip.finalOdds,
    cashoutAmountCents,
  });
  const balanceAfterCents = getNextBalanceCents({
    currentBalanceCents: portfolio.allocatedBalanceCents,
    entryType: settlementCalc.ledgerEntryType,
    amountCents: settlementCalc.payoutCents,
  });

  return {
    dryRun: true,
    writes: false,
    canSettle: true,
    settlement: {
      betSlipId,
      result,
      payoutCents: settlementCalc.payoutCents,
      profitLossCents: settlementCalc.profitLossCents,
      ledgerEntryType: settlementCalc.ledgerEntryType,
      balanceAfterCents,
    },
    warnings: [],
  };
}
