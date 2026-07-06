import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches, matchResults } from "@/db/schema";

export async function listMatches() {
  const db = getDb();
  const rows = db.select().from(matches).orderBy(asc(matches.kickoffAt)).all();
  const results = db.select().from(matchResults).orderBy(desc(matchResults.settledAt), desc(matchResults.createdAt)).all();
  const latestResultByMatchId = new Map<string, (typeof results)[number]>();
  for (const result of results) {
    if (!latestResultByMatchId.has(result.matchId)) {
      latestResultByMatchId.set(result.matchId, result);
    }
  }

  return rows.map((match) => {
    const latestResult = latestResultByMatchId.get(match.id);

    return {
      ...match,
      latestResultHomeScore: latestResult?.homeScore ?? null,
      latestResultAwayScore: latestResult?.awayScore ?? null,
      latestResultStatus: latestResult?.resultStatus ?? null,
      latestResultSettledAt: latestResult?.settledAt ?? null,
    };
  });
}
