import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches, oddsSnapshots } from "@/db/schema";
import { getConfiguredOddsSources, fetchOddsSourceFixture } from "@/server/providers/odds-source-sync";
import { createId } from "@/server/actions/ids";

type OddsSyncRow = {
  matchId: string;
  matchNumber: number;
  bookmaker: string;
  inserted: number;
};

type OddsSyncSkipped = {
  matchNumber: number;
  bookmaker: string;
  reason: string;
};

export type OddsSyncResult = {
  fetchedAt: string;
  inserted: number;
  rows: OddsSyncRow[];
  skipped: OddsSyncSkipped[];
  errors: OddsSyncSkipped[];
};

export async function syncReferenceOdds(now = new Date()): Promise<OddsSyncResult> {
  const db = getDb();
  const fetchedAt = now.toISOString();
  const rows: OddsSyncRow[] = [];
  const skipped: OddsSyncSkipped[] = [];
  const errors: OddsSyncSkipped[] = [];
  let inserted = 0;

  for (const fixture of getConfiguredOddsSources()) {
    const match = db
      .select()
      .from(matches)
      .where(eq(matches.matchNumber, fixture.matchNumber))
      .get();

    if (!match) {
      skipped.push({ matchNumber: fixture.matchNumber, bookmaker: fixture.bookmaker, reason: "match not found" });
      continue;
    }

    if (new Date(match.kickoffAt).getTime() <= now.getTime()) {
      skipped.push({ matchNumber: fixture.matchNumber, bookmaker: fixture.bookmaker, reason: "kickoff reached" });
      continue;
    }

    try {
      const market = await fetchOddsSourceFixture(fixture, fetchedAt);
      const values = market.selections.map((selection) => ({
        id: createId("odds"),
        matchId: match.id,
        bookmaker: market.bookmaker,
        market: market.market,
        selection: selection.selection,
        line: undefined,
        decimalOdds: selection.decimalOdds,
        capturedAt: market.capturedAt,
        createdBy: "importer" as const,
        sourceActor: market.bookmaker,
        sourceType: "reference_sync",
        sourceNote: `${market.sourceLabel}: ${market.sourceUrl}`,
      }));

      db.insert(oddsSnapshots).values(values).run();
      inserted += values.length;
      rows.push({
        matchId: match.id,
        matchNumber: fixture.matchNumber,
        bookmaker: fixture.bookmaker,
        inserted: values.length,
      });
    } catch (error) {
      errors.push({
        matchNumber: fixture.matchNumber,
        bookmaker: fixture.bookmaker,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { fetchedAt, inserted, rows, skipped, errors };
}
