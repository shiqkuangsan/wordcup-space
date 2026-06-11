import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { syncMatches } from "@/server/actions/match-sync";
import {
  buildWorldCup2026ApiSyncPayload,
  fetchWorldCup2026Games,
  fetchWorldCup2026Stadiums,
  getWorldCup2026ApiBaseUrl,
  normalizeWorldCup2026Games,
  WORLDCUP2026_API_SOURCE_NAME,
} from "@/server/providers/worldcup2026-api";

const DEFAULT_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

type WorldCupApiSyncStatus = {
  attempted: boolean;
  ok: boolean;
  reason: "fresh" | "stale" | "empty" | "failed";
  lastSyncedAt?: string;
  error?: string;
};

export async function syncWorldCup2026ApiMatches() {
  const baseUrl = getWorldCup2026ApiBaseUrl();
  const sourceUrl = `${baseUrl}/get/games`;
  const fetchedAt = new Date().toISOString();
  const [games, stadiums] = await Promise.all([fetchWorldCup2026Games(baseUrl), fetchWorldCup2026Stadiums(baseUrl)]);
  const normalized = normalizeWorldCup2026Games({ games, stadiums, sourceUrl });

  if (normalized.matches.length === 0) {
    throw new Error(`worldcup2026 API returned no syncable matches. Warnings: ${normalized.warnings.join("; ")}`);
  }

  const result = await syncMatches(
    buildWorldCup2026ApiSyncPayload({
      normalized,
      fetchedAt,
      sourceUrl,
    }),
  );

  return {
    ...result,
    results: normalized.results,
    warnings: normalized.warnings,
  };
}

export async function ensureWorldCup2026ApiMatchesFresh(staleAfterMs = DEFAULT_STALE_AFTER_MS): Promise<WorldCupApiSyncStatus> {
  const newest = getDb()
    .select({ lastSyncedAt: matches.lastSyncedAt })
    .from(matches)
    .where(eq(matches.dataSource, WORLDCUP2026_API_SOURCE_NAME))
    .orderBy(desc(matches.lastSyncedAt))
    .limit(1)
    .get();

  const lastSyncedAt = newest?.lastSyncedAt ?? undefined;
  const isEmpty = !lastSyncedAt;
  const isStale = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() > staleAfterMs : true;

  if (!isEmpty && !isStale) {
    return { attempted: false, ok: true, reason: "fresh", lastSyncedAt };
  }

  try {
    const result = await syncWorldCup2026ApiMatches();
    return {
      attempted: true,
      ok: true,
      reason: isEmpty ? "empty" : "stale",
      lastSyncedAt: result.fetchedAt,
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      reason: "failed",
      lastSyncedAt,
      error: error instanceof Error ? error.message : "Unknown sync error",
    };
  }
}
