import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "@/db/client";
import { matches, settlements } from "@/db/schema";
import { syncWorldCup2026ApiMatches } from "@/server/actions/worldcup2026-api-sync";

let tempDir: string;
let dbPath: string;

function applyMigrations(databasePath: string) {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");

  const migrationDir = path.join(process.cwd(), "drizzle");
  for (const fileName of readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(migrationDir, fileName), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }

  sqlite.close();
}

beforeEach(() => {
  tempDir = mkdtempSync(path.join(os.tmpdir(), "wordcup2026-api-sync-test-"));
  dbPath = path.join(tempDir, "test.db");
  process.env.DATABASE_URL = dbPath;
  process.env.WORLDCUP2026_API_BASE_URL = "https://example.test";
  resetDbForTests();
  applyMigrations(dbPath);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetDbForTests();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
  delete process.env.WORLDCUP2026_API_BASE_URL;
});

describe("worldcup2026 API sync action", () => {
  it("syncs provider games into matches without creating settlements", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/get/games")) {
          return Response.json({
            games: [
              {
                id: "1",
                home_score: "0",
                away_score: "0",
                group: "A",
                matchday: "1",
                local_date: "06/11/2026 13:00",
                stadium_id: "1",
                finished: "FALSE",
                time_elapsed: "notstarted",
                type: "group",
                home_team_name_en: "Mexico",
                away_team_name_en: "South Africa",
              },
            ],
          });
        }

        if (url.endsWith("/get/stadiums")) {
          return Response.json({
            stadiums: [
              {
                id: "1",
                name_en: "Estadio Azteca",
                fifa_name: "Mexico City Stadium",
                city_en: "Mexico City",
                country_en: "Mexico",
              },
            ],
          });
        }

        return new Response("not found", { status: 404 });
      }),
    );

    const result = await syncWorldCup2026ApiMatches();

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.results).toEqual([
      {
        externalId: "worldcup2026-game-1",
        homeScore: 0,
        awayScore: 0,
        status: "pending",
      },
    ]);
    expect(result.warnings).toEqual([]);

    const row = getDb().select().from(matches).where(eq(matches.id, result.matchIds[0])).get();
    expect(row?.dataSource).toBe("worldcup2026-api");
    expect(row?.homeTeam).toBe("墨西哥");
    expect(row?.awayTeam).toBe("南非");

    expect(getDb().select().from(settlements).all()).toHaveLength(0);
  });
});
