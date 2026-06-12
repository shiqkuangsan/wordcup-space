import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches, oddsSnapshots } from "@/db/schema";
import { getConfiguredOddsSources, fetchOddsSourceFixture, getOddsSourceBookmaker } from "@/server/providers/odds-source-sync";
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

function normalizeSelectionSet(values: Array<{ selection: string; decimalOdds: number; line?: string | null }>) {
  return values
    .map((value) => ({
      selection: value.selection,
      decimalOdds: Number(value.decimalOdds.toFixed(2)),
      line: value.line ?? null,
    }))
    .sort((a, b) => a.selection.localeCompare(b.selection));
}

function sameMarketOdds(
  previous: Array<{ selection: string; decimalOdds: number; line?: string | null }>,
  next: Array<{ selection: string; decimalOdds: number; line?: string | null }>,
) {
  return JSON.stringify(normalizeSelectionSet(previous)) === JSON.stringify(normalizeSelectionSet(next));
}

export async function syncReferenceOdds(now = new Date()): Promise<OddsSyncResult> {
  const db = getDb();
  const fetchedAt = now.toISOString();
  const rows: OddsSyncRow[] = [];
  const skipped: OddsSyncSkipped[] = [];
  const errors: OddsSyncSkipped[] = [];
  let inserted = 0;

  for (const fixture of getConfiguredOddsSources()) {
    const bookmaker = getOddsSourceBookmaker(fixture);
    const match = db
      .select()
      .from(matches)
      .where(eq(matches.matchNumber, fixture.matchNumber))
      .get();

    if (!match) {
      skipped.push({ matchNumber: fixture.matchNumber, bookmaker, reason: "match not found" });
      continue;
    }

    if (new Date(match.kickoffAt).getTime() <= now.getTime()) {
      skipped.push({ matchNumber: fixture.matchNumber, bookmaker, reason: "kickoff reached" });
      continue;
    }

    try {
      const market = await fetchOddsSourceFixture(fixture, fetchedAt);
      const latest = db
        .select({ capturedAt: oddsSnapshots.capturedAt })
        .from(oddsSnapshots)
        .where(and(eq(oddsSnapshots.matchId, match.id), eq(oddsSnapshots.bookmaker, market.bookmaker), eq(oddsSnapshots.market, market.market)))
        .orderBy(desc(oddsSnapshots.capturedAt))
        .get();
      const latestValues = latest
        ? db
            .select()
            .from(oddsSnapshots)
            .where(
              and(
                eq(oddsSnapshots.matchId, match.id),
                eq(oddsSnapshots.bookmaker, market.bookmaker),
                eq(oddsSnapshots.market, market.market),
                eq(oddsSnapshots.capturedAt, latest.capturedAt),
              ),
            )
            .all()
        : [];

      if (latestValues.length > 0 && sameMarketOdds(latestValues, market.selections)) {
        skipped.push({ matchNumber: fixture.matchNumber, bookmaker: market.bookmaker, reason: "unchanged" });
        continue;
      }

      const values = market.selections.map((selection) => ({
        id: createId("odds"),
        matchId: match.id,
        bookmaker: market.bookmaker,
        market: market.market,
        selection: selection.selection,
        line: undefined,
        decimalOdds: selection.decimalOdds,
        capturedAt: market.capturedAt,
        createdBy: "sync:odds" as const,
        sourceActor: market.bookmaker,
        sourceType: "api",
        sourceNote: `${market.sourceLabel}: ${market.sourceUrl}`,
      }));

      db.insert(oddsSnapshots).values(values).run();
      inserted += values.length;
      rows.push({
        matchId: match.id,
        matchNumber: fixture.matchNumber,
        bookmaker: market.bookmaker,
        inserted: values.length,
      });
    } catch (error) {
      errors.push({
        matchNumber: fixture.matchNumber,
        bookmaker,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { fetchedAt, inserted, rows, skipped, errors };
}
