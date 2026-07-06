import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { captureSabaOdds, writeSabaOddsRows, type SabaCaptureScope } from "@/server/providers/saba-odds-api";
import { parseBwOddsText, writeBwOddsRows } from "@/server/providers/bw-odds-capture";
import { assessOddsCaptureCompleteness } from "@/server/providers/odds-capture-completeness";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireFlag(name: string) {
  const value = readFlag(name);
  if (!value) throw new Error(`missing required flag: ${name}`);
  return value;
}

function readNumberFlag(name: string, fallback: number) {
  const value = readFlag(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function readScope(): SabaCaptureScope {
  const value = readFlag("--scope") ?? "common";
  if (value !== "common" && value !== "all") throw new Error("--scope must be common or all");
  return value;
}

function normalizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function findFallbackTextFile(input: {
  fallbackTextDir?: string;
  matchId: string;
  matchNumber: number | null;
  homeTeam: string;
  awayTeam: string;
}) {
  if (!input.fallbackTextDir) return undefined;
  const exactCandidates = [
    input.matchNumber ? `${input.matchNumber}.txt` : undefined,
    input.matchNumber ? `match-${input.matchNumber}.txt` : undefined,
    `${input.matchId}.txt`,
    `${normalizeFilename(`${input.homeTeam}-vs-${input.awayTeam}`)}.txt`,
    `${normalizeFilename(`${input.awayTeam}-vs-${input.homeTeam}`)}.txt`,
  ].filter(Boolean) as string[];

  for (const candidate of exactCandidates) {
    const path = join(input.fallbackTextDir, candidate);
    if (existsSync(path)) return path;
  }

  if (!existsSync(input.fallbackTextDir)) return undefined;
  const looseNeedles = [
    input.matchNumber ? String(input.matchNumber) : "",
    normalizeFilename(input.homeTeam),
    normalizeFilename(input.awayTeam),
  ].filter(Boolean);
  return readdirSync(input.fallbackTextDir)
    .filter((file) => file.endsWith(".txt"))
    .map((file) => join(input.fallbackTextDir!, file))
    .find((path) => {
      const normalized = normalizeFilename(basename(path));
      return looseNeedles.every((needle) => normalized.includes(needle));
    });
}

async function main() {
  const localDate = requireFlag("--date");
  const write = process.argv.includes("--write");
  const requireComplete = process.argv.includes("--require-complete");
  const scope = readScope();
  const capturedAt = readFlag("--captured-at") ?? new Date().toISOString();
  const fallbackTextDir = readFlag("--fallback-text-dir");
  const minimumMarkets = readNumberFlag("--min-markets", 4);
  const minimumRows = readNumberFlag("--min-rows", 20);

  const sabaResult = await captureSabaOdds({
    localDate,
    scope,
    bookmaker: readFlag("--api-bookmaker") ?? "bw-shameng-saba",
    capturedAt,
    requestDelayMs: readNumberFlag("--request-delay-ms", 250),
    write: false,
  });

  const pageBookmaker = readFlag("--page-bookmaker") ?? "bw-shameng-page";
  let apiInserted = 0;
  let fallbackInserted = 0;
  const matches = sabaResult.matches.map((match) => {
    const apiCompleteness = assessOddsCaptureCompleteness(match.rows, { minimumMarkets, minimumRows });
    const fallbackFile = apiCompleteness.status === "complete" ? undefined : findFallbackTextFile({
      fallbackTextDir,
      matchId: match.matchId,
      matchNumber: match.matchNumber,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
    });

    let fallbackParsed = [] as ReturnType<typeof parseBwOddsText>["parsed"];
    let fallbackSkippedSections: string[] = [];
    if (fallbackFile) {
      const parsed = parseBwOddsText({
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        text: readFileSync(fallbackFile, "utf8"),
        bookmaker: pageBookmaker,
        capturedAt,
      });
      fallbackParsed = parsed.parsed;
      fallbackSkippedSections = parsed.skippedSections;
    }

    const fallbackCompleteness = fallbackFile
      ? assessOddsCaptureCompleteness(fallbackParsed, { minimumMarkets, minimumRows })
      : undefined;
    const effectiveRows = fallbackParsed.length > 0 ? fallbackParsed : match.rows;
    const effectiveCompleteness = assessOddsCaptureCompleteness(effectiveRows, { minimumMarkets, minimumRows });
    if (write && effectiveCompleteness.status === "complete") {
      if (fallbackParsed.length > 0) {
        fallbackInserted += writeBwOddsRows(fallbackParsed);
      } else {
        apiInserted += writeSabaOddsRows(match.rows);
      }
    }

    return {
      matchId: match.matchId,
      matchNumber: match.matchNumber,
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffAt: match.kickoffAt,
      sabaMatchId: match.sabaMatchId,
      sabaMarketCount: match.sabaMarketCount,
      sabaTitle: match.sabaHomeTeam && match.sabaAwayTeam ? `${match.sabaHomeTeam} vs ${match.sabaAwayTeam}` : undefined,
      homeAwayMismatch: match.homeAwayMismatch,
      apiSkippedReason: match.skippedReason,
      apiParsedCount: match.rows.length,
      apiCompleteness,
      fallbackFile,
      fallbackParsedCount: fallbackParsed.length,
      fallbackSkippedSections,
      fallbackCompleteness,
      effectiveCompleteness,
      effectiveMarkets: effectiveCompleteness.markets,
      needsFallback: effectiveCompleteness.status !== "complete",
    };
  });

  const incomplete = matches.filter((match) => match.needsFallback);
  const result = {
    dryRun: !write,
    write,
    localDate,
    capturedAt,
    scope,
    inserted: apiInserted + fallbackInserted,
    apiInserted,
    fallbackInserted,
    sourcePlan: fallbackTextDir ? ["saba_api", "bw_page_text_fallback"] : ["saba_api"],
    completenessThreshold: { minimumMarkets, minimumRows },
    incompleteCount: incomplete.length,
    matches,
    nextAction: incomplete.length
      ? "有比赛盘口不完整：请打开对应 SABA/BW 比赛详情页复制页面文本到 fallback 目录后重跑，或改用登录态页面采集。"
      : "全部比赛盘口覆盖满足当前阈值。",
  };

  console.log(JSON.stringify(result, null, 2));
  if (requireComplete && incomplete.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
