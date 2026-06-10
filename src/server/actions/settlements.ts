import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { betSlips, portfolioLedgerEntries, portfolios, settlements } from "@/db/schema";
import { canSettleBetSlip } from "@/domain/bet-lifecycle";
import { getNextBalanceCents } from "@/domain/ledger";
import { calculateSettlement } from "@/domain/settlement";
import { createId } from "@/server/actions/ids";

const settleBetSlipSchema = z.object({
  betSlipId: z.string().min(1),
  result: z.enum(["won", "lost", "void", "half_won", "half_lost", "cashout", "cancelled"]),
  cashoutAmountCents: z.number().int().nonnegative().optional(),
  settledBy: z.string().default("user"),
  sourceNote: z.string().min(1),
  settledAt: z.string().default(() => new Date().toISOString()),
}).superRefine((data, ctx) => {
  if (data.result === "cashout" && data.cashoutAmountCents === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cashoutAmountCents"],
      message: "cashout settlement requires cashoutAmountCents",
    });
  }
});

export async function settleBetSlip(input: z.input<typeof settleBetSlipSchema>) {
  const data = settleBetSlipSchema.parse(input);
  const db = getDb();

  return db.transaction((tx) => {
    const slip = tx.select().from(betSlips).where(eq(betSlips.id, data.betSlipId)).get();
    if (!slip) throw new Error(`bet slip not found: ${data.betSlipId}`);
    if (!canSettleBetSlip(slip)) throw new Error("bet slip cannot be settled");

    const portfolio = tx
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, slip.portfolioId))
      .get();
    if (!portfolio) throw new Error(`portfolio not found: ${slip.portfolioId}`);

    const settlementCalc = calculateSettlement({
      result: data.result,
      stakeCents: slip.stakeCents,
      finalOdds: slip.finalOdds,
      cashoutAmountCents: data.cashoutAmountCents,
    });
    const nextBalance = getNextBalanceCents({
      currentBalanceCents: portfolio.allocatedBalanceCents,
      entryType: settlementCalc.ledgerEntryType,
      amountCents: settlementCalc.payoutCents,
    });
    const settlement = {
      id: createId("settlement"),
      betSlipId: slip.id,
      result: data.result,
      payoutCents: settlementCalc.payoutCents,
      profitLossCents: settlementCalc.profitLossCents,
      settledBy: data.settledBy,
      sourceNote: data.sourceNote,
      settledAt: data.settledAt,
    };

    tx.insert(settlements).values(settlement).run();
    tx.update(betSlips)
      .set({
        status: data.result,
        settledAt: data.settledAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(betSlips.id, slip.id))
      .run();
    tx.update(portfolios)
      .set({
        allocatedBalanceCents: nextBalance,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(portfolios.id, slip.portfolioId))
      .run();
    tx.insert(portfolioLedgerEntries)
      .values({
        id: createId("ledger"),
        portfolioId: slip.portfolioId,
        entryType: settlementCalc.ledgerEntryType,
        amountCents: settlementCalc.payoutCents,
        balanceAfterCents: nextBalance,
        currency: portfolio.currency,
        isRealMoney: slip.isRealMoney,
        betSlipId: slip.id,
        sourceActor: data.settledBy,
        notes: data.sourceNote,
      })
      .run();

    return settlement;
  });
}
