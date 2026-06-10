import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  betIntentLegs,
  betIntents,
  betSlipLegs,
  betSlips,
  executionAttempts,
  matches,
  platformAccounts,
  portfolioLedgerEntries,
  portfolios,
} from "@/db/schema";
import { getNextBalanceCents } from "@/domain/ledger";
import { getPotentialReturnCents } from "@/domain/money";
import { getOddsChangePct, normalizeOddsFormat, toDecimalOdds } from "@/domain/odds";
import { formatTeamName } from "@/domain/team-names";
import { createId } from "@/server/actions/ids";

type Body = Record<string, unknown>;

function centsFromBody(body: Body) {
  const cents =
    typeof body.stakeCents === "number"
      ? body.stakeCents
      : Math.round(Number(body.stake) * 100);

  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error("stake/stakeCents must be a positive number");
  }

  return cents;
}

function positiveNumber(value: unknown, name: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return numberValue;
}

function requiredString(value: unknown, name: string) {
  const stringValue = String(value ?? "").trim();
  if (!stringValue) {
    throw new Error(`${name} is required`);
  }

  return stringValue;
}

function optionalString(value: unknown) {
  const stringValue = String(value ?? "").trim();
  return stringValue || undefined;
}

function resolveMatch(body: Body) {
  const db = getDb();
  const matchId = optionalString(body.matchId);

  if (matchId) {
    const match = db.select().from(matches).where(eq(matches.id, matchId)).get();
    if (!match) throw new Error(`match not found: ${matchId}`);
    return {
      match,
      matchText: `${match.homeTeam} vs ${match.awayTeam}`,
    };
  }

  const matchText = optionalString(body.matchText);
  if (matchText) {
    return {
      match: undefined,
      matchText,
    };
  }

  const homeTeam = optionalString(body.homeTeam);
  const awayTeam = optionalString(body.awayTeam);
  if (!homeTeam || !awayTeam) {
    throw new Error("matchId, matchText or homeTeam/awayTeam is required");
  }

  const normalizedHome = formatTeamName(homeTeam);
  const normalizedAway = formatTeamName(awayTeam);
  const candidates = db.select().from(matches).all().filter((match) => {
    const home = formatTeamName(match.homeTeam);
    const away = formatTeamName(match.awayTeam);
    return (
      (home === normalizedHome && away === normalizedAway) ||
      (home === normalizedAway && away === normalizedHome)
    );
  });

  if (candidates.length === 0) {
    throw new Error(`match not found: ${normalizedHome} vs ${normalizedAway}`);
  }
  if (candidates.length > 1) {
    throw new Error(`multiple matches found: ${normalizedHome} vs ${normalizedAway}`);
  }

  return {
    match: candidates[0],
    matchText: `${candidates[0].homeTeam} vs ${candidates[0].awayTeam}`,
  };
}

function normalizePlacedBet(body: Body) {
  const db = getDb();
  const resolvedMatch = resolveMatch(body);
  const portfolioId = requiredString(body.portfolioId ?? "user", "portfolioId");
  const decisionBy = requiredString(body.decisionBy ?? portfolioId, "decisionBy");
  const platformAccountId = requiredString(body.platformAccountId, "platformAccountId");
  const stakeCents = centsFromBody(body);
  const oddsFormat = normalizeOddsFormat(body.oddsFormat);
  const rawOdds = positiveNumber(body.rawOdds ?? body.finalOdds ?? body.odds, "rawOdds");
  const finalOdds = toDecimalOdds(rawOdds, oddsFormat);
  const rawIntendedOdds = positiveNumber(body.rawIntendedOdds ?? body.intendedOdds ?? body.observedOdds ?? rawOdds, "rawIntendedOdds");
  const rawObservedOdds = positiveNumber(body.rawObservedOdds ?? body.observedOdds ?? rawOdds, "rawObservedOdds");
  const intendedOdds = toDecimalOdds(rawIntendedOdds, oddsFormat);
  const observedOdds = toDecimalOdds(rawObservedOdds, oddsFormat);
  const market = requiredString(body.market, "market");
  const selection = requiredString(body.selection, "selection");
  const confirmationRef = optionalString(body.confirmationRef);
  const portfolio = db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).get();
  const platformAccount = db.select().from(platformAccounts).where(eq(platformAccounts.id, platformAccountId)).get();

  if (!portfolio) throw new Error(`portfolio not found: ${portfolioId}`);
  if (!platformAccount) throw new Error(`platform account not found: ${platformAccountId}`);
  if (!["user", "codex"].includes(portfolioId)) throw new Error("portfolioId must be user or codex");
  if (!["user", "codex"].includes(decisionBy)) throw new Error("decisionBy must be user or codex");

  const existingSlip = confirmationRef
    ? db.select().from(betSlips).where(eq(betSlips.confirmationRef, confirmationRef)).get()
    : undefined;
  const oddsTolerancePct =
    typeof body.oddsTolerancePct === "number" ? body.oddsTolerancePct : 0.06;
  const oddsChangePct = getOddsChangePct(intendedOdds, observedOdds);
  const potentialReturnCents = getPotentialReturnCents(stakeCents, finalOdds);
  const balanceAfterCents = getNextBalanceCents({
    currentBalanceCents: portfolio.allocatedBalanceCents,
    entryType: "stake_paid",
    amountCents: stakeCents,
  });
  const warnings: string[] = [];

  if (existingSlip) warnings.push("注单号已存在，请确认不是重复录入。");
  if (balanceAfterCents < 0) warnings.push("余额不足，不能写入真实成交注单。");
  if (oddsChangePct >= oddsTolerancePct) warnings.push("观察赔率与最终赔率变化达到或超过容忍区间。");
  if (!confirmationRef) warnings.push("缺少注单号/确认号，后续去重和核对会变困难。");

  return {
    match: resolvedMatch.match,
    matchText: resolvedMatch.matchText,
    portfolio,
    platformAccount,
    draft: {
      portfolioId: portfolioId as "user" | "codex",
      decisionBy: decisionBy as "user" | "codex",
      mode: String(body.mode ?? "single") as "single" | "parlay",
      market,
      selection,
      line: optionalString(body.line),
      stakeCents,
      finalOdds,
      oddsFormat,
      rawOdds,
      intendedOdds,
      observedOdds,
      rawObservedOdds,
      oddsChangePct,
      oddsTolerancePct,
      potentialReturnCents,
      balanceAfterCents,
      riskTier: String(body.riskTier ?? "normal"),
      confidence: String(body.confidence ?? "medium"),
      rationale: requiredString(body.rationale ?? body.sourceText ?? "已成交截图直录。", "rationale"),
      executionMethod: String(body.executionMethod ?? "user_manual") as "user_manual" | "chrome" | "computer_use" | "browser_capture",
      confirmationRef,
      confirmationScreenshotPath: optionalString(body.confirmationScreenshotPath),
      isRealMoney: body.isRealMoney !== false,
      placedAt: optionalString(body.placedAt) ?? new Date().toISOString(),
      sourceText: optionalString(body.sourceText),
    },
    canCreate: warnings.length === 0,
    warnings,
  };
}

export function buildPlacedBetPreview(body: Body) {
  const normalized = normalizePlacedBet(body);

  return {
    dryRun: true,
    writes: false,
    canCreate: normalized.canCreate,
    match: {
      id: normalized.match?.id,
      title: normalized.matchText,
      kickoffAt: normalized.match?.kickoffAt,
      status: normalized.match?.status,
    },
    intent: {
      portfolioId: normalized.draft.portfolioId,
      decisionBy: normalized.draft.decisionBy,
      mode: normalized.draft.mode,
      market: normalized.draft.market,
      intendedStakeCents: normalized.draft.stakeCents,
      intendedTotalOdds: normalized.draft.intendedOdds,
      riskTier: normalized.draft.riskTier,
      confidence: normalized.draft.confidence,
      rationale: normalized.draft.rationale,
      status: "executed",
    },
    leg: {
      matchId: normalized.match?.id,
      matchText: normalized.matchText,
      market: normalized.draft.market,
      selection: normalized.draft.selection,
      line: normalized.draft.line,
      intendedOdds: normalized.draft.intendedOdds,
      finalOdds: normalized.draft.finalOdds,
      oddsFormat: normalized.draft.oddsFormat,
      rawOdds: normalized.draft.rawOdds,
    },
    slip: {
      portfolioId: normalized.draft.portfolioId,
      decisionBy: normalized.draft.decisionBy,
      mode: normalized.draft.mode,
      stakeCents: normalized.draft.stakeCents,
      finalOdds: normalized.draft.finalOdds,
      potentialReturnCents: normalized.draft.potentialReturnCents,
      balanceAfterCents: normalized.draft.balanceAfterCents,
      confirmationRef: normalized.draft.confirmationRef,
      isRealMoney: normalized.draft.isRealMoney,
    },
    attempt: {
      executionMethod: normalized.draft.executionMethod,
      intendedOdds: normalized.draft.intendedOdds,
      observedOdds: normalized.draft.observedOdds,
      rawObservedOdds: normalized.draft.rawObservedOdds,
      oddsChangePct: normalized.draft.oddsChangePct,
      oddsTolerancePct: normalized.draft.oddsTolerancePct,
    },
    warnings: normalized.warnings,
  };
}

export function createPlacedBetFromDraft(body: Body) {
  const normalized = normalizePlacedBet(body);
  if (!normalized.canCreate) {
    throw new Error(normalized.warnings.join("；"));
  }

  const db = getDb();

  return db.transaction((tx) => {
    const now = new Date().toISOString();
    const intent = {
      id: createId("intent"),
      portfolioId: normalized.draft.portfolioId,
      decisionBy: normalized.draft.decisionBy,
      mode: normalized.draft.mode,
      market: normalized.draft.market,
      intendedStakeCents: normalized.draft.stakeCents,
      intendedTotalOdds: normalized.draft.intendedOdds,
      riskTier: normalized.draft.riskTier,
      confidence: normalized.draft.confidence,
      status: "executed",
      approvalMode: "auto",
      rationale: normalized.draft.rationale,
    };
    const intentLeg = {
      id: createId("intent-leg"),
      betIntentId: intent.id,
      matchId: normalized.match?.id,
      matchText: normalized.matchText,
      market: normalized.draft.market,
      selection: normalized.draft.selection,
      line: normalized.draft.line,
      intendedOdds: normalized.draft.intendedOdds,
      legOrder: 1,
      notes: normalized.draft.sourceText,
    };
    const attempt = {
      id: createId("attempt"),
      betIntentId: intent.id,
      executionMethod: normalized.draft.executionMethod,
      status: "succeeded",
      platformAccountId: normalized.platformAccount.id,
      intendedOdds: normalized.draft.intendedOdds,
      observedOdds: normalized.draft.observedOdds,
      oddsFormat: normalized.draft.oddsFormat,
      rawObservedOdds: normalized.draft.rawObservedOdds,
      oddsChangePct: normalized.draft.oddsChangePct,
      oddsTolerancePct: normalized.draft.oddsTolerancePct,
      startedAt: normalized.draft.placedAt,
      finishedAt: normalized.draft.placedAt,
      notes: normalized.draft.sourceText ?? "已成交截图直录。",
    };
    const slip = {
      id: createId("slip"),
      betIntentId: intent.id,
      executionAttemptId: attempt.id,
      platformAccountId: normalized.platformAccount.id,
      portfolioId: normalized.draft.portfolioId,
      decisionBy: normalized.draft.decisionBy,
      placedBy: "user",
      isRealMoney: normalized.draft.isRealMoney,
      mode: normalized.draft.mode,
      stakeCents: normalized.draft.stakeCents,
      finalOdds: normalized.draft.finalOdds,
      oddsFormat: normalized.draft.oddsFormat,
      rawOdds: normalized.draft.rawOdds,
      potentialReturnCents: normalized.draft.potentialReturnCents,
      confirmationRef: normalized.draft.confirmationRef,
      confirmationScreenshotPath: normalized.draft.confirmationScreenshotPath,
      status: "open",
      placedAt: normalized.draft.placedAt,
    };
    const slipLeg = {
      id: createId("slip-leg"),
      betSlipId: slip.id,
      matchId: normalized.match?.id,
      matchText: normalized.matchText,
      market: normalized.draft.market,
      selection: normalized.draft.selection,
      line: normalized.draft.line,
      finalOdds: normalized.draft.finalOdds,
      oddsFormat: normalized.draft.oddsFormat,
      rawOdds: normalized.draft.rawOdds,
      status: "open",
      legOrder: 1,
      notes: normalized.draft.sourceText,
    };

    tx.insert(betIntents).values(intent).run();
    tx.insert(betIntentLegs).values(intentLeg).run();
    tx.insert(executionAttempts).values(attempt).run();
    tx.insert(betSlips).values(slip).run();
    tx.insert(betSlipLegs).values(slipLeg).run();
    tx.update(portfolios)
      .set({
        allocatedBalanceCents: normalized.draft.balanceAfterCents,
        updatedAt: now,
      })
      .where(eq(portfolios.id, normalized.draft.portfolioId))
      .run();
    tx.insert(portfolioLedgerEntries)
      .values({
        id: createId("ledger"),
        portfolioId: normalized.draft.portfolioId,
        entryType: "stake_paid",
        amountCents: normalized.draft.stakeCents,
        balanceAfterCents: normalized.draft.balanceAfterCents,
        currency: normalized.portfolio.currency,
        isRealMoney: normalized.draft.isRealMoney,
        betSlipId: slip.id,
        sourceActor: normalized.draft.decisionBy,
        notes: normalized.draft.sourceText ?? "已成交截图直录扣款。",
      })
      .run();

    return { intent, intentLeg, attempt, slip, slipLeg };
  });
}
