import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { formatTeamName } from "@/domain/team-names";
import { syncMatches } from "@/server/actions/match-sync";

export const WORLDCUP_2026_SOURCE_NAME = "openfootball-worldcup-json-2026";
export const WORLDCUP_2026_SOURCE_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const DEFAULT_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

type OpenFootballMatch = {
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
};

type OpenFootballPayload = {
  name: string;
  matches: OpenFootballMatch[];
};

type WorldCupSyncStatus = {
  attempted: boolean;
  ok: boolean;
  reason: "fresh" | "stale" | "empty" | "failed";
  lastSyncedAt?: string;
  error?: string;
};

function parseKickoff(date: string, time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})$/);
  if (!match) {
    throw new Error(`Unsupported kickoff time: ${date} ${time}`);
  }

  const [, hourText, minuteText, offsetText] = match;
  const [year, month, day] = date.split("-").map(Number);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const offsetHours = Number(offsetText);
  const utcMs = Date.UTC(year, month - 1, day, hour - offsetHours, minute, 0);

  return new Date(utcMs).toISOString();
}

function groupLetter(group: string): string {
  return group.replace(/^Group\s+/i, "").trim();
}

export async function syncWorldCup2026Matches() {
  const response = await fetch(WORLDCUP_2026_SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${WORLDCUP_2026_SOURCE_URL}: ${response.status}`);
  }

  const data = (await response.json()) as OpenFootballPayload;
  const groupMatches = data.matches.filter((match) => /^Group\s+[A-L]$/i.test(match.group ?? ""));

  return syncMatches({
    sourceName: WORLDCUP_2026_SOURCE_NAME,
    sourceUrl: WORLDCUP_2026_SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    matches: groupMatches.map((match, index) => ({
      externalId: `ofwc2026-group-${index + 1}`,
      competition: "世界杯",
      season: "2026",
      matchNumber: index + 1,
      stage: "group_stage",
      groupName: groupLetter(match.group ?? ""),
      homeTeam: formatTeamName(match.team1),
      awayTeam: formatTeamName(match.team2),
      kickoffAt: parseKickoff(match.date, match.time),
      venue: match.ground,
      status: "scheduled",
      sourceUrl: WORLDCUP_2026_SOURCE_URL,
    })),
  });
}

export async function ensureWorldCup2026MatchesFresh(staleAfterMs = DEFAULT_STALE_AFTER_MS): Promise<WorldCupSyncStatus> {
  const newest = getDb()
    .select({ lastSyncedAt: matches.lastSyncedAt })
    .from(matches)
    .where(eq(matches.dataSource, WORLDCUP_2026_SOURCE_NAME))
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
    const result = await syncWorldCup2026Matches();
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
