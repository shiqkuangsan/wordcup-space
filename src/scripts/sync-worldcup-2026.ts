import { formatTeamName } from "@/domain/team-names";
import { syncMatches } from "@/server/actions/match-sync";

const SOURCE_NAME = "openfootball-worldcup-json-2026";
const SOURCE_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

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

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status}`);
  }

  const data = (await response.json()) as OpenFootballPayload;
  const groupMatches = data.matches.filter((match) => /^Group\s+[A-L]$/i.test(match.group ?? ""));

  const result = await syncMatches({
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
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
      sourceUrl: SOURCE_URL,
    })),
  });

  console.log(
    JSON.stringify(
      {
        sourceName: result.sourceName,
        created: result.created,
        updated: result.updated,
        total: result.matchIds.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
