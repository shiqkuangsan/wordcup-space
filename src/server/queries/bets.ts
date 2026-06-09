import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betSlips } from "@/db/schema";

export async function listBetSlips() {
  return getDb().select().from(betSlips).orderBy(desc(betSlips.createdAt)).all();
}
