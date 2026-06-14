import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/server/api/responses";
import { captureSabaOdds } from "@/server/providers/saba-odds-api";

const requestSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.enum(["common", "all"]).default("common"),
  write: z.boolean().default(false),
  requestDelayMs: z.number().int().min(0).max(5_000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const input = requestSchema.parse(await request.json());
    const result = await captureSabaOdds(input);
    return apiOk({
      dryRun: result.dryRun,
      write: result.write,
      bookmaker: result.bookmaker,
      capturedAt: result.capturedAt,
      scope: result.scope,
      inserted: result.inserted,
      totalRows: result.matches.reduce((sum, match) => sum + match.rows.length, 0),
      matches: result.matches.map((match) => ({
        matchId: match.matchId,
        matchNumber: match.matchNumber,
        title: `${match.homeTeam} vs ${match.awayTeam}`,
        kickoffAt: match.kickoffAt,
        sabaTitle:
          match.sabaHomeTeam && match.sabaAwayTeam
            ? `${match.sabaHomeTeam} vs ${match.sabaAwayTeam}`
            : null,
        homeAwayMismatch: Boolean(match.homeAwayMismatch),
        skippedReason: match.skippedReason ?? null,
        parsedCount: match.rows.length,
        markets: Array.from(new Set(match.rows.map((row) => row.market))).sort(),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
