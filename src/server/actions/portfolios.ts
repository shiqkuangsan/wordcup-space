import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { portfolioLedgerEntries, portfolios } from "@/db/schema";
import { getNextBalanceCents } from "@/domain/ledger";
import { createId } from "@/server/actions/ids";

const adjustPortfolioAllocationSchema = z.object({
  portfolioId: z.enum(["user", "codex"]),
  entryType: z.enum([
    "allocation_initial",
    "allocation_top_up",
    "allocation_withdrawal",
    "adjustment",
  ]),
  amountCents: z.number().int(),
  isRealMoney: z.boolean().default(true),
  sourceActor: z.string().default("user"),
  notes: z.string().min(1),
});

export async function adjustPortfolioAllocation(
  input: z.input<typeof adjustPortfolioAllocationSchema>,
) {
  const data = adjustPortfolioAllocationSchema.parse(input);
  const db = getDb();

  return db.transaction((tx) => {
    const portfolio = tx
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, data.portfolioId))
      .get();

    if (!portfolio) throw new Error(`portfolio not found: ${data.portfolioId}`);

    const nextBalance = getNextBalanceCents({
      currentBalanceCents: portfolio.allocatedBalanceCents,
      entryType: data.entryType,
      amountCents: data.amountCents,
    });

    if (nextBalance < 0) throw new Error("portfolio balance cannot be negative");

    tx.update(portfolios)
      .set({
        allocatedBalanceCents: nextBalance,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(portfolios.id, data.portfolioId))
      .run();

    const ledgerEntry = {
      id: createId("ledger"),
      portfolioId: data.portfolioId,
      entryType: data.entryType,
      amountCents: data.amountCents,
      balanceAfterCents: nextBalance,
      currency: portfolio.currency,
      isRealMoney: data.isRealMoney,
      sourceActor: data.sourceActor,
      notes: data.notes,
    };

    tx.insert(portfolioLedgerEntries).values(ledgerEntry).run();

    return ledgerEntry;
  });
}
