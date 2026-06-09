import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betIntents, betSlips, portfolioLedgerEntries, portfolios } from "@/db/schema";

export async function getDashboardSummary() {
  const db = getDb();

  return {
    portfolios: db.select().from(portfolios).all(),
    openBetSlips: db.select().from(betSlips).where(eq(betSlips.status, "open")).all(),
    pendingIntents: db
      .select()
      .from(betIntents)
      .where(eq(betIntents.status, "proposed"))
      .all(),
    recentLedgerEntries: db
      .select()
      .from(portfolioLedgerEntries)
      .orderBy(desc(portfolioLedgerEntries.createdAt))
      .limit(10)
      .all(),
    recentBetSlips: db.select().from(betSlips).orderBy(desc(betSlips.createdAt)).limit(10).all(),
  };
}
