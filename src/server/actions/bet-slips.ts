import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  betIntentLegs,
  betIntents,
  betSlipLegs,
  betSlips,
  executionAttempts,
  portfolioLedgerEntries,
  portfolios,
} from "@/db/schema";
import { canCreateBetSlip, isIntentExecutable } from "@/domain/bet-lifecycle";
import { getNextBalanceCents } from "@/domain/ledger";
import { getPotentialReturnCents } from "@/domain/money";
import { createId } from "@/server/actions/ids";

const createBetSlipFromAttemptSchema = z.object({
  executionAttemptId: z.string().min(1),
  platformAccountId: z.string().min(1),
  stakeCents: z.number().int().positive(),
  finalOdds: z.number().positive(),
  oddsFormat: z.enum(["decimal", "hong_kong"]).default("decimal"),
  rawOdds: z.number().positive().optional(),
  confirmationRef: z.string().optional(),
  confirmationScreenshotPath: z.string().optional(),
  isRealMoney: z.boolean().default(true),
  placedAt: z.string().default(() => new Date().toISOString()),
});

export async function createBetSlipFromAttempt(
  input: z.input<typeof createBetSlipFromAttemptSchema>,
) {
  const data = createBetSlipFromAttemptSchema.parse(input);
  const db = getDb();

  return db.transaction((tx) => {
    const attempt = tx
      .select()
      .from(executionAttempts)
      .where(eq(executionAttempts.id, data.executionAttemptId))
      .get();

    if (!attempt) throw new Error(`execution attempt not found: ${data.executionAttemptId}`);
    if (!canCreateBetSlip(attempt)) throw new Error("execution attempt cannot create bet slip");

    const intent = tx
      .select()
      .from(betIntents)
      .where(eq(betIntents.id, attempt.betIntentId))
      .get();

    if (!intent) throw new Error(`bet intent not found: ${attempt.betIntentId}`);
    if (!isIntentExecutable(intent, new Date(data.placedAt))) throw new Error("bet intent execution window has expired");

    const portfolio = tx
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, intent.portfolioId))
      .get();

    if (!portfolio) throw new Error(`portfolio not found: ${intent.portfolioId}`);

    const nextBalance = getNextBalanceCents({
      currentBalanceCents: portfolio.allocatedBalanceCents,
      entryType: "stake_paid",
      amountCents: data.stakeCents,
    });

    if (nextBalance < 0) throw new Error("insufficient portfolio balance");

    const betSlip = {
      id: createId("slip"),
      betIntentId: intent.id,
      executionAttemptId: attempt.id,
      platformAccountId: data.platformAccountId,
      portfolioId: intent.portfolioId,
      decisionBy: intent.decisionBy,
      placedBy: "user",
      isRealMoney: data.isRealMoney,
      mode: intent.mode,
      stakeCents: data.stakeCents,
      finalOdds: data.finalOdds,
      oddsFormat: data.oddsFormat,
      rawOdds: data.rawOdds,
      potentialReturnCents: getPotentialReturnCents(data.stakeCents, data.finalOdds),
      confirmationRef: data.confirmationRef,
      confirmationScreenshotPath: data.confirmationScreenshotPath,
      status: "open",
      placedAt: data.placedAt,
    };

    tx.insert(betSlips).values(betSlip).run();
    const intentLegs = tx
      .select()
      .from(betIntentLegs)
      .where(eq(betIntentLegs.betIntentId, intent.id))
      .all();

    for (const leg of intentLegs) {
      tx.insert(betSlipLegs)
        .values({
          id: createId("slip-leg"),
          betSlipId: betSlip.id,
          matchId: leg.matchId,
          matchText: leg.matchText,
          market: leg.market,
          selection: leg.selection,
          line: leg.line,
          finalOdds: data.finalOdds,
          oddsFormat: data.oddsFormat,
          rawOdds: data.rawOdds,
          status: "open",
          legOrder: leg.legOrder,
          notes: leg.notes,
        })
        .run();
    }

    tx.update(portfolios)
      .set({
        allocatedBalanceCents: nextBalance,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(portfolios.id, intent.portfolioId))
      .run();
    tx.insert(portfolioLedgerEntries)
      .values({
        id: createId("ledger"),
        portfolioId: intent.portfolioId,
        entryType: "stake_paid",
        amountCents: data.stakeCents,
        balanceAfterCents: nextBalance,
        currency: portfolio.currency,
        isRealMoney: data.isRealMoney,
        betSlipId: betSlip.id,
        sourceActor: intent.decisionBy,
        notes: "注单成交扣款。",
      })
      .run();
    tx.update(betIntents)
      .set({ status: "executed", updatedAt: new Date().toISOString() })
      .where(eq(betIntents.id, intent.id))
      .run();

    return betSlip;
  });
}
