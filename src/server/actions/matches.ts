import { z } from "zod";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { createId } from "@/server/actions/ids";

const createMatchSchema = z.object({
  competition: z.string().default("FIFA World Cup"),
  season: z.string().default("2026"),
  stage: z.string().min(1),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  kickoffAt: z.string().min(1),
  venue: z.string().optional(),
  status: z.string().default("scheduled"),
  dataSource: z.string().optional(),
});

export async function createMatch(input: z.input<typeof createMatchSchema>) {
  const data = createMatchSchema.parse(input);
  const row = { id: createId("match"), ...data };

  getDb().insert(matches).values(row).run();

  return row;
}
