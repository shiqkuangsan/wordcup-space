import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { matches, matchResults } from "@/db/schema";
import { matchStatusSchema, normalizeMatchStatus } from "@/domain/match-sync";
import { createId } from "@/server/actions/ids";

const recordMatchResultSchema = z.object({
  matchId: z.string().min(1),
  homeScore: z.number().int().nonnegative().optional(),
  awayScore: z.number().int().nonnegative().optional(),
  resultStatus: z.union([matchStatusSchema, z.string().min(1)]).default("finished").transform(normalizeMatchStatus),
  sourceActor: z.string().min(1).default("user"),
  sourceNote: z.string().min(1),
  settledAt: z.string().optional(),
});

export async function recordMatchResult(input: z.input<typeof recordMatchResultSchema>) {
  const data = recordMatchResultSchema.parse(input);
  const db = getDb();
  const match = db.select().from(matches).where(eq(matches.id, data.matchId)).get();
  if (!match) throw new Error(`match not found: ${data.matchId}`);

  const row = {
    id: createId("match-result"),
    ...data,
    settledAt: data.settledAt ?? new Date().toISOString(),
  };

  db.transaction((tx) => {
    tx.insert(matchResults).values(row).run();
    tx.update(matches)
      .set({
        status: data.resultStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(matches.id, data.matchId))
      .run();
  });

  return row;
}
