import { z } from "zod";
import { getDb } from "@/db/client";
import { oddsSnapshots } from "@/db/schema";
import { createId } from "@/server/actions/ids";

const addOddsSnapshotSchema = z.object({
  matchId: z.string().min(1),
  bookmaker: z.string().min(1),
  market: z.string().min(1),
  selection: z.string().min(1),
  line: z.string().optional(),
  decimalOdds: z.number().positive(),
  capturedAt: z.string().min(1),
  createdBy: z.enum(["user", "codex", "importer"]),
  sourceActor: z.string().min(1),
  sourceType: z.string().min(1),
  sourceNote: z.string().optional(),
});

export async function addOddsSnapshot(input: z.input<typeof addOddsSnapshotSchema>) {
  const data = addOddsSnapshotSchema.parse(input);
  const row = { id: createId("odds"), ...data };

  getDb().insert(oddsSnapshots).values(row).run();

  return row;
}
