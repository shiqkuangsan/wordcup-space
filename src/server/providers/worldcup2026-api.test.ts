import { describe, expect, it } from "vitest";
import {
  WORLDCUP2026_API_SOURCE_NAME,
  buildWorldCup2026ApiSyncPayload,
  normalizeWorldCup2026Games,
  parseWorldCup2026LocalDate,
} from "@/server/providers/worldcup2026-api";

const sampleGame = {
  _id: "679c9c8a5749c4077500e001",
  id: "1",
  home_team_id: "1",
  away_team_id: "2",
  home_score: "0",
  away_score: "0",
  home_scorers: "null",
  away_scorers: "null",
  group: "A",
  matchday: "1",
  local_date: "06/11/2026 13:00",
  persian_date: "1405-03-21 13:00",
  stadium_id: "1",
  finished: "FALSE",
  time_elapsed: "notstarted",
  type: "group",
  home_team_name_en: "Mexico",
  home_team_name_fa: "مکزیک",
  away_team_name_en: "South Africa",
  away_team_name_fa: "آفریقای جنوبی",
};

const sampleStadium = {
  _id: "679c9c8a5749c4077500f001",
  id: "1",
  name_en: "Estadio Azteca",
  name_fa: "ورزشگاه آزتکا",
  fifa_name: "Mexico City Stadium",
  city_en: "Mexico City",
  city_fa: "مکزیکوسیتی",
  country_en: "Mexico",
  country_fa: "مکزیک",
  capacity: 87523,
  region: "Central",
};

describe("worldcup2026 API provider", () => {
  it("converts venue local dates into ISO kickoff times", () => {
    expect(parseWorldCup2026LocalDate("06/11/2026 13:00", "America/Mexico_City")).toBe(
      "2026-06-11T19:00:00.000Z",
    );
  });

  it("normalizes games into match sync inputs without settlement side effects", () => {
    const result = normalizeWorldCup2026Games({
      games: [sampleGame],
      stadiums: [sampleStadium],
      sourceUrl: "https://worldcup26.ir/get/games",
    });

    expect(result.matches).toEqual([
      {
        externalId: "worldcup2026-game-1",
        competition: "世界杯",
        season: "2026",
        matchNumber: 1,
        stage: "group_stage",
        groupName: "A",
        homeTeam: "墨西哥",
        awayTeam: "南非",
        kickoffAt: "2026-06-11T19:00:00.000Z",
        venue: "Mexico City Stadium",
        status: "scheduled",
        sourceUrl: "https://worldcup26.ir/get/games",
      },
    ]);
    expect(result.results).toEqual([
      {
        externalId: "worldcup2026-game-1",
        homeScore: 0,
        awayScore: 0,
        status: "pending",
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("builds a sync payload with stable source metadata", () => {
    const payload = buildWorldCup2026ApiSyncPayload({
      normalized: normalizeWorldCup2026Games({
        games: [sampleGame],
        stadiums: [sampleStadium],
        sourceUrl: "https://worldcup26.ir/get/games",
      }),
      fetchedAt: "2026-06-10T00:00:00.000Z",
      sourceUrl: "https://worldcup26.ir/get/games",
    });

    expect(payload.sourceName).toBe(WORLDCUP2026_API_SOURCE_NAME);
    expect(payload.fetchedAt).toBe("2026-06-10T00:00:00.000Z");
    expect(payload.matches).toHaveLength(1);
  });

  it("handles provider city names with parenthetical host areas", () => {
    const result = normalizeWorldCup2026Games({
      games: [
        {
          ...sampleGame,
          id: "16",
          local_date: "06/14/2026 12:00",
          stadium_id: "16",
        },
      ],
      stadiums: [
        {
          ...sampleStadium,
          id: "16",
          fifa_name: "Los Angeles Stadium",
          city_en: "Los Angeles (Inglewood)",
          country_en: "United States",
        },
      ],
    });

    expect(result.matches[0]?.venue).toBe("Los Angeles Stadium");
    expect(result.warnings).toEqual([]);
  });
});
