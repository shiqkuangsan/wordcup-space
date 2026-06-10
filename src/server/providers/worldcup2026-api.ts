import { z } from "zod";
import type { MatchStage, MatchStatus, SyncMatchesPayload } from "@/domain/match-sync";
import { formatTeamName } from "@/domain/team-names";

export const WORLDCUP2026_API_SOURCE_NAME = "worldcup2026-api";
export const DEFAULT_WORLDCUP2026_API_BASE_URL = "https://worldcup26.ir";

const gameSchema = z
  .object({
    id: z.string().min(1),
    home_team_id: z.string().optional(),
    away_team_id: z.string().optional(),
    home_score: z.string().optional(),
    away_score: z.string().optional(),
    group: z.string().optional(),
    matchday: z.string().optional(),
    local_date: z.string().min(1),
    stadium_id: z.string().optional(),
    finished: z.string().optional(),
    time_elapsed: z.string().optional(),
    type: z.string().optional(),
    home_team_name_en: z.string().optional(),
    away_team_name_en: z.string().optional(),
    home_team_label: z.string().optional(),
    away_team_label: z.string().optional(),
  })
  .passthrough();

const stadiumSchema = z
  .object({
    id: z.string().min(1),
    name_en: z.string().optional(),
    fifa_name: z.string().optional(),
    city_en: z.string().optional(),
    country_en: z.string().optional(),
  })
  .passthrough();

const gamesResponseSchema = z.object({
  games: z.array(gameSchema),
});

const stadiumsResponseSchema = z.object({
  stadiums: z.array(stadiumSchema),
});

export type WorldCup2026ApiGame = z.infer<typeof gameSchema>;
export type WorldCup2026ApiStadium = z.infer<typeof stadiumSchema>;

export type WorldCup2026ApiResult = {
  externalId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "pending" | "live" | "finished";
};

export type NormalizedWorldCup2026Games = {
  matches: SyncMatchesPayload["matches"];
  results: WorldCup2026ApiResult[];
  warnings: string[];
};

const cityTimeZones: Record<string, string> = {
  "atlanta": "America/New_York",
  "boston": "America/New_York",
  "dallas": "America/Chicago",
  "east rutherford": "America/New_York",
  "guadalajara": "America/Mexico_City",
  "houston": "America/Chicago",
  "kansas city": "America/Chicago",
  "los angeles": "America/Los_Angeles",
  "miami": "America/New_York",
  "mexico city": "America/Mexico_City",
  "monterrey": "America/Monterrey",
  "new york/new jersey": "America/New_York",
  "philadelphia": "America/New_York",
  "san francisco bay area": "America/Los_Angeles",
  "seattle": "America/Los_Angeles",
  "toronto": "America/Toronto",
  "vancouver": "America/Vancouver",
};

const stageByType: Record<string, MatchStage> = {
  group: "group_stage",
  r32: "round_of_32",
  r16: "round_of_16",
  qf: "quarter_final",
  sf: "semi_final",
  third: "third_place",
  final: "final",
};

export function getWorldCup2026ApiBaseUrl() {
  return (process.env.WORLDCUP2026_API_BASE_URL ?? DEFAULT_WORLDCUP2026_API_BASE_URL).replace(/\/$/, "");
}

export async function fetchWorldCup2026Games(baseUrl = getWorldCup2026ApiBaseUrl()) {
  const response = await fetchJson(`${baseUrl}/get/games`);
  return gamesResponseSchema.parse(response).games;
}

export async function fetchWorldCup2026Stadiums(baseUrl = getWorldCup2026ApiBaseUrl()) {
  const response = await fetchJson(`${baseUrl}/get/stadiums`);
  return stadiumsResponseSchema.parse(response).stadiums;
}

export async function fetchWorldCup2026Teams(baseUrl = getWorldCup2026ApiBaseUrl()) {
  const response = await fetchJson(`${baseUrl}/get/teams`);
  return z.object({ teams: z.array(z.unknown()) }).parse(response).teams;
}

export async function fetchWorldCup2026Groups(baseUrl = getWorldCup2026ApiBaseUrl()) {
  const response = await fetchJson(`${baseUrl}/get/groups`);
  return z.object({ groups: z.array(z.unknown()) }).parse(response).groups;
}

export function normalizeWorldCup2026Games({
  games,
  stadiums,
  sourceUrl,
}: {
  games: WorldCup2026ApiGame[];
  stadiums: WorldCup2026ApiStadium[];
  sourceUrl?: string;
}): NormalizedWorldCup2026Games {
  const stadiumById = new Map(stadiums.map((stadium) => [stadium.id, stadium]));
  const matches: SyncMatchesPayload["matches"] = [];
  const results: WorldCup2026ApiResult[] = [];
  const warnings: string[] = [];

  for (const game of games) {
    const externalId = toExternalId(game.id);
    const stadium = game.stadium_id ? stadiumById.get(game.stadium_id) : undefined;
    const timeZone = stadium ? timeZoneForStadium(stadium) : undefined;

    if (!timeZone) {
      warnings.push(`Skipped ${externalId}: missing timezone for stadium ${game.stadium_id ?? "unknown"}`);
      continue;
    }

    let kickoffAt: string;
    try {
      kickoffAt = parseWorldCup2026LocalDate(game.local_date, timeZone);
    } catch (error) {
      warnings.push(
        `Skipped ${externalId}: invalid local_date ${game.local_date} (${error instanceof Error ? error.message : "unknown error"})`,
      );
      continue;
    }

    matches.push({
      externalId,
      competition: "世界杯",
      season: "2026",
      matchNumber: toPositiveInt(game.id),
      stage: stageForGame(game),
      groupName: groupNameForGame(game),
      homeTeam: formatTeamName(teamNameForGame(game, "home")),
      awayTeam: formatTeamName(teamNameForGame(game, "away")),
      kickoffAt,
      venue: venueNameForStadium(stadium),
      status: statusForGame(game),
      sourceUrl,
    });

    results.push({
      externalId,
      homeScore: parseNullableScore(game.home_score),
      awayScore: parseNullableScore(game.away_score),
      status: resultStatusForGame(game),
    });
  }

  return { matches, results, warnings };
}

export function buildWorldCup2026ApiSyncPayload({
  normalized,
  fetchedAt = new Date().toISOString(),
  sourceUrl,
}: {
  normalized: NormalizedWorldCup2026Games;
  fetchedAt?: string;
  sourceUrl?: string;
}): SyncMatchesPayload {
  return {
    sourceName: WORLDCUP2026_API_SOURCE_NAME,
    sourceUrl,
    fetchedAt,
    matches: normalized.matches,
  };
}

export function parseWorldCup2026LocalDate(localDate: string, timeZone: string): string {
  const match = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Unsupported local date: ${localDate}`);
  }

  const [, monthText, dayText, yearText, hourText, minuteText] = match;
  const wallClockUtc = Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
  );
  let utcMs = wallClockUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    utcMs = wallClockUtc - offsetMs;
  }

  return new Date(utcMs).toISOString();
}

async function fetchJson(url: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.WORLDCUP2026_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.WORLDCUP2026_API_TOKEN}`;
  }

  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return zonedAsUtc - date.getTime();
}

function timeZoneForStadium(stadium: WorldCup2026ApiStadium): string | undefined {
  const cityKey = normalizeCityKey(stadium.city_en);
  return cityKey ? cityTimeZones[cityKey] : undefined;
}

function normalizeCityKey(city: string | undefined): string | undefined {
  return city
    ?.replace(/\s*\(.+\)\s*$/, "")
    .trim()
    .toLowerCase();
}

function venueNameForStadium(stadium: WorldCup2026ApiStadium | undefined): string | undefined {
  if (!stadium) return undefined;
  return stadium.fifa_name || stadium.name_en;
}

function stageForGame(game: WorldCup2026ApiGame): MatchStage {
  const type = game.type?.trim().toLowerCase();
  return type ? (stageByType[type] ?? "unknown") : "unknown";
}

function statusForGame(game: WorldCup2026ApiGame): MatchStatus {
  if (game.finished?.toUpperCase() === "TRUE") return "finished";

  const elapsed = game.time_elapsed?.trim().toLowerCase();
  if (!elapsed || elapsed === "notstarted" || elapsed === "not_started") return "scheduled";

  return "live";
}

function resultStatusForGame(game: WorldCup2026ApiGame): WorldCup2026ApiResult["status"] {
  const status = statusForGame(game);
  if (status === "finished") return "finished";
  if (status === "live") return "live";
  return "pending";
}

function groupNameForGame(game: WorldCup2026ApiGame): string | undefined {
  return game.type?.trim().toLowerCase() === "group" ? game.group : undefined;
}

function teamNameForGame(game: WorldCup2026ApiGame, side: "home" | "away"): string {
  if (side === "home") {
    return game.home_team_name_en || game.home_team_label || "TBD";
  }
  return game.away_team_name_en || game.away_team_label || "TBD";
}

function toExternalId(id: string) {
  return `worldcup2026-game-${id}`;
}

function toPositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNullableScore(value: string | undefined): number | null {
  if (!value || value === "null") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}
