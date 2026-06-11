import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { syncMatchesPayloadSchema } from "@/domain/match-sync";
import { createId } from "@/server/actions/ids";

type SyncResult = {
  sourceName: string;
  fetchedAt: string;
  created: number;
  updated: number;
  matchIds: string[];
};

const sourcePriority: Record<string, number> = {
  "openfootball-worldcup-json-2026": 10,
  "worldcup2026-api": 100,
};

function canReplaceMatchFacts(existingSource: string | null, incomingSource: string) {
  const existingPriority = existingSource ? (sourcePriority[existingSource] ?? 100) : 0;
  const incomingPriority = sourcePriority[incomingSource] ?? 100;
  return incomingPriority >= existingPriority;
}

export async function syncMatches(input: z.input<typeof syncMatchesPayloadSchema>): Promise<SyncResult> {
  const payload = syncMatchesPayloadSchema.parse(input);
  const db = getDb();
  const now = new Date().toISOString();

  return db.transaction((tx) => {
    let created = 0;
    let updated = 0;
    const matchIds: string[] = [];

    for (const item of payload.matches) {
      const existing = item.matchNumber
        ? tx
            .select()
            .from(matches)
            .where(
              and(
                eq(matches.competition, item.competition),
                eq(matches.season, item.season),
                eq(matches.matchNumber, item.matchNumber),
              ),
            )
            .get()
        : tx
            .select()
            .from(matches)
            .where(and(eq(matches.dataSource, payload.sourceName), eq(matches.externalId, item.externalId)))
            .get();

      const row = {
        competition: item.competition,
        season: item.season,
        stage: item.stage,
        homeTeam: item.homeTeam,
        awayTeam: item.awayTeam,
        kickoffAt: item.kickoffAt,
        venue: item.venue,
        status: item.status,
        dataSource: payload.sourceName,
        externalId: item.externalId,
        matchNumber: item.matchNumber,
        groupName: item.groupName,
        sourceUrl: item.sourceUrl ?? payload.sourceUrl,
        lastSyncedAt: payload.fetchedAt,
        updatedAt: now,
      };

      if (existing) {
        if (canReplaceMatchFacts(existing.dataSource, payload.sourceName)) {
          tx.update(matches).set(row).where(eq(matches.id, existing.id)).run();
        }
        updated += 1;
        matchIds.push(existing.id);
      } else {
        const id = createId("match");
        tx.insert(matches)
          .values({
            id,
            ...row,
          })
          .run();
        created += 1;
        matchIds.push(id);
      }
    }

    return {
      sourceName: payload.sourceName,
      fetchedAt: payload.fetchedAt,
      created,
      updated,
      matchIds,
    };
  });
}
