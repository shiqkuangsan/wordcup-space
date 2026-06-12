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

function optionalPositiveNumber(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return positiveNumber(value, name);
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

function getField(leg: Body, fallback: Body, name: string) {
  return leg[name] ?? fallback[name];
}

function getLegBodies(body: Body) {
  if (!Array.isArray(body.legs)) return [body];
  if (body.legs.length === 0) throw new Error("legs must not be empty");

  return body.legs.map((leg, index) => {
    if (!leg || typeof leg !== "object" || Array.isArray(leg)) {
      throw new Error(`legs[${index}] must be an object`);
    }

    return leg as Body;
  });
}

function resolveMatch(leg: Body, fallback: Body) {
  const db = getDb();
  const matchId = optionalString(getField(leg, fallback, "matchId"));

  if (matchId) {
    const match = db.select().from(matches).where(eq(matches.id, matchId)).get();
    if (!match) throw new Error(`match not found: ${matchId}`);
    return {
      match,
      matchText: `${match.homeTeam} vs ${match.awayTeam}`,
    };
  }

  const matchText = optionalString(getField(leg, fallback, "matchText"));
  if (matchText) {
    return {
      match: undefined,
      matchText,
    };
  }

  const homeTeam = optionalString(getField(leg, fallback, "homeTeam"));
  const awayTeam = optionalString(getField(leg, fallback, "awayTeam"));
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

function normalizeLegs(body: Body) {
  return getLegBodies(body).map((leg, index) => {
    const resolvedMatch = resolveMatch(leg, body);
    const oddsFormat = normalizeOddsFormat(getField(leg, body, "oddsFormat"));
    const rawFinalOdds = positiveNumber(
      leg.rawOdds ?? leg.finalOdds ?? leg.odds ?? leg.intendedOdds,
      `legs[${index}].finalOdds`,
    );
    const rawIntendedOdds = positiveNumber(
      leg.rawIntendedOdds ?? leg.intendedOdds ?? leg.observedOdds ?? rawFinalOdds,
      `legs[${index}].intendedOdds`,
    );
    const rawObservedOdds = positiveNumber(
      leg.rawObservedOdds ?? leg.observedOdds ?? rawFinalOdds,
      `legs[${index}].observedOdds`,
    );

    return {
      match: resolvedMatch.match,
      matchText: resolvedMatch.matchText,
      market: requiredString(getField(leg, body, "market"), `legs[${index}].market`),
      selection: requiredString(getField(leg, body, "selection"), `legs[${index}].selection`),
      line: optionalString(getField(leg, body, "line")),
      intendedOdds: toDecimalOdds(rawIntendedOdds, oddsFormat),
      observedOdds: toDecimalOdds(rawObservedOdds, oddsFormat),
      finalOdds: toDecimalOdds(rawFinalOdds, oddsFormat),
      oddsFormat,
      rawOdds: rawFinalOdds,
      rawObservedOdds,
      legOrder: Number(leg.legOrder ?? index + 1),
      notes: optionalString(leg.notes ?? body.sourceText),
    };
  });
}

function multiplyOdds(values: number[]) {
  return values.reduce((total, odds) => total * odds, 1);
}

function normalizeActor(value: unknown, name: string) {
  const actor = requiredString(value, name);
  if (!["user", "codex"].includes(actor)) throw new Error(`${name} must be user or codex`);
  return actor as "user" | "codex";
}

function normalizePlacedBet(body: Body) {
  const db = getDb();
  const legs = normalizeLegs(body);
  const portfolioId = normalizeActor(body.portfolioId ?? "user", "portfolioId");
  const decisionBy = normalizeActor(body.decisionBy ?? portfolioId, "decisionBy");
  const placedBy = normalizeActor(body.placedBy ?? "user", "placedBy");
  const platformAccountId = requiredString(body.platformAccountId, "platformAccountId");
  const stakeCents = centsFromBody(body);
  const oddsFormat = normalizeOddsFormat(body.oddsFormat);
  const mode = String(body.mode ?? (legs.length > 1 ? "parlay" : "single")) as "single" | "parlay";
  const rawTotalOdds = optionalPositiveNumber(
    body.rawOdds ?? body.finalOdds ?? body.odds,
    "finalOdds",
  );
  const finalOdds = rawTotalOdds
    ? toDecimalOdds(rawTotalOdds, oddsFormat)
    : multiplyOdds(legs.map((leg) => leg.finalOdds));
  const rawIntendedTotalOdds = optionalPositiveNumber(
    body.rawIntendedOdds ?? body.intendedTotalOdds ?? body.intendedOdds,
    "intendedTotalOdds",
  );
  const intendedOdds = rawIntendedTotalOdds
    ? toDecimalOdds(rawIntendedTotalOdds, oddsFormat)
    : multiplyOdds(legs.map((leg) => leg.intendedOdds));
  const rawObservedTotalOdds = optionalPositiveNumber(
    body.rawObservedOdds ?? body.observedOdds,
    "observedOdds",
  );
  const observedOdds = rawObservedTotalOdds
    ? toDecimalOdds(rawObservedTotalOdds, oddsFormat)
    : multiplyOdds(legs.map((leg) => leg.observedOdds));
  const rawObservedOdds = rawObservedTotalOdds ?? observedOdds;
  const market = optionalString(body.market) ?? (mode === "parlay" ? "parlay" : legs[0].market);
  const confirmationRef = optionalString(body.confirmationRef);
  const portfolio = db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).get();
  const platformAccount = db.select().from(platformAccounts).where(eq(platformAccounts.id, platformAccountId)).get();

  if (!portfolio) throw new Error(`portfolio not found: ${portfolioId}`);
  if (!platformAccount) throw new Error(`platform account not found: ${platformAccountId}`);

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

  if (!["single", "parlay"].includes(mode)) warnings.push("mode 必须是 single 或 parlay。");
  if (mode === "single" && legs.length > 1) warnings.push("多腿注单必须使用 parlay mode。");
  if (mode === "parlay" && legs.length < 2) warnings.push("串关注单至少需要 2 条 legs。");
  if (existingSlip) warnings.push("注单号已存在，请确认不是重复录入。");
  if (balanceAfterCents < 0) warnings.push("余额不足，不能写入真实成交注单。");
  if (oddsChangePct >= oddsTolerancePct) warnings.push("观察赔率与最终赔率变化达到或超过容忍区间。");
  if (!confirmationRef) warnings.push("缺少注单号/确认号，后续去重和核对会变困难。");

  return {
    match: legs[0].match,
    matchText: legs[0].matchText,
    legs,
    portfolio,
    platformAccount,
    draft: {
      portfolioId,
      decisionBy,
      placedBy,
      mode,
      market,
      stakeCents,
      finalOdds,
      oddsFormat,
      rawOdds: rawTotalOdds ?? finalOdds,
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
  const previewLegs = normalized.legs.map((leg) => ({
    matchId: leg.match?.id,
    matchText: leg.matchText,
    market: leg.market,
    selection: leg.selection,
    line: leg.line,
    intendedOdds: leg.intendedOdds,
    finalOdds: leg.finalOdds,
    oddsFormat: leg.oddsFormat,
    rawOdds: leg.rawOdds,
    legOrder: leg.legOrder,
  }));

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
    matches: normalized.legs.map((leg) => ({
      id: leg.match?.id,
      title: leg.matchText,
      kickoffAt: leg.match?.kickoffAt,
      status: leg.match?.status,
    })),
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
    leg: previewLegs[0],
    legs: previewLegs,
    slip: {
      portfolioId: normalized.draft.portfolioId,
      decisionBy: normalized.draft.decisionBy,
      placedBy: normalized.draft.placedBy,
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
    const intentLegs = normalized.legs.map((leg) => ({
      id: createId("intent-leg"),
      betIntentId: intent.id,
      matchId: leg.match?.id,
      matchText: leg.matchText,
      market: leg.market,
      selection: leg.selection,
      line: leg.line,
      intendedOdds: leg.intendedOdds,
      legOrder: leg.legOrder,
      notes: leg.notes,
    }));
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
      placedBy: normalized.draft.placedBy,
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
    const slipLegs = normalized.legs.map((leg) => ({
      id: createId("slip-leg"),
      betSlipId: slip.id,
      matchId: leg.match?.id,
      matchText: leg.matchText,
      market: leg.market,
      selection: leg.selection,
      line: leg.line,
      finalOdds: leg.finalOdds,
      oddsFormat: leg.oddsFormat,
      rawOdds: leg.rawOdds,
      status: "open",
      legOrder: leg.legOrder,
      notes: leg.notes,
    }));

    tx.insert(betIntents).values(intent).run();
    for (const leg of intentLegs) tx.insert(betIntentLegs).values(leg).run();
    tx.insert(executionAttempts).values(attempt).run();
    tx.insert(betSlips).values(slip).run();
    for (const leg of slipLegs) tx.insert(betSlipLegs).values(leg).run();
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

    return {
      intent,
      intentLeg: intentLegs[0],
      intentLegs,
      attempt,
      slip,
      slipLeg: slipLegs[0],
      slipLegs,
    };
  });
}
