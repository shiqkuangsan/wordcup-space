import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";

export async function listMatches() {
  return getDb().select().from(matches).orderBy(asc(matches.kickoffAt)).all();
}
