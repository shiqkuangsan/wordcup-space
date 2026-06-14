import { captureSabaOdds, type SabaCaptureScope } from "@/server/providers/saba-odds-api";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireFlag(name: string) {
  const value = readFlag(name);
  if (!value) throw new Error(`missing required flag: ${name}`);
  return value;
}

function readScope(): SabaCaptureScope {
  const value = readFlag("--scope") ?? "common";
  if (value !== "common" && value !== "all") {
    throw new Error("--scope must be common or all");
  }
  return value;
}

async function main() {
  const write = process.argv.includes("--write");
  const localDate = requireFlag("--date");
  const result = await captureSabaOdds({
    localDate,
    scope: readScope(),
    bookmaker: readFlag("--bookmaker") ?? "bw-shameng-saba",
    capturedAt: readFlag("--captured-at"),
    requestDelayMs: Number(readFlag("--request-delay-ms") ?? 250),
    write,
  });

  console.log(JSON.stringify({
    dryRun: result.dryRun,
    write: result.write,
    bookmaker: result.bookmaker,
    capturedAt: result.capturedAt,
    scope: result.scope,
    inserted: result.inserted,
    matches: result.matches.map((match) => ({
      matchId: match.matchId,
      matchNumber: match.matchNumber,
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffAt: match.kickoffAt,
      sabaMatchId: match.sabaMatchId,
      sabaTitle: match.sabaHomeTeam && match.sabaAwayTeam ? `${match.sabaHomeTeam} vs ${match.sabaAwayTeam}` : undefined,
      homeAwayMismatch: match.homeAwayMismatch,
      skippedReason: match.skippedReason,
      parsedCount: match.rows.length,
      markets: Array.from(new Set(match.rows.map((row) => row.market))).sort(),
      preview: match.rows.slice(0, 20),
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
