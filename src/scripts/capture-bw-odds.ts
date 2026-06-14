import { readFileSync } from "node:fs";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { parseBwOddsText, writeBwOddsRows } from "@/server/providers/bw-odds-capture";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireFlag(name: string) {
  const value = readFlag(name);
  if (!value) throw new Error(`missing required flag: ${name}`);
  return value;
}

function readInputText() {
  if (process.argv.includes("--stdin")) return readFileSync(0, "utf8");
  const textFile = readFlag("--text-file");
  if (!textFile) throw new Error("missing required flag: --text-file or --stdin");
  return readFileSync(textFile, "utf8");
}

function getMatch(matchId: string) {
  const match = getDb().select().from(matches).all().find((row) => row.id === matchId || String(row.matchNumber) === matchId);
  if (!match) throw new Error(`match not found: ${matchId}`);
  return match;
}

async function main() {
  const matchId = requireFlag("--match-id");
  const bookmaker = readFlag("--bookmaker") ?? "bw-shameng";
  const write = process.argv.includes("--write");
  const dryRun = process.argv.includes("--dry-run") || !write;
  const capturedAt = readFlag("--captured-at") ?? new Date().toISOString();
  const match = getMatch(matchId);
  const text = readInputText();
  const result = parseBwOddsText({
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    text,
    bookmaker,
    capturedAt,
  });

  const inserted = write ? writeBwOddsRows(result.parsed) : 0;
  console.log(JSON.stringify({
    dryRun,
    write,
    inserted,
    match: {
      id: match.id,
      matchNumber: match.matchNumber,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoffAt: match.kickoffAt,
    },
    bookmaker: result.bookmaker,
    capturedAt: result.capturedAt,
    parsedCount: result.parsed.length,
    skippedSections: result.skippedSections,
    parsed: result.parsed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
