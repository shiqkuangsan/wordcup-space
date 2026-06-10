import { syncMatches } from "@/server/actions/match-sync";
import {
  buildWorldCup2026ApiSyncPayload,
  fetchWorldCup2026Games,
  fetchWorldCup2026Stadiums,
  getWorldCup2026ApiBaseUrl,
  normalizeWorldCup2026Games,
} from "@/server/providers/worldcup2026-api";

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
