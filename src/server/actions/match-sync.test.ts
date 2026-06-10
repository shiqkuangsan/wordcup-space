import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/db/client";
import { matches } from "@/db/schema";
import { syncMatches } from "@/server/actions/match-sync";

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
  tempDir = mkdtempSync(path.join(os.tmpdir(), "wordcup-sync-test-"));
  dbPath = path.join(tempDir, "test.db");
  process.env.DATABASE_URL = dbPath;
  resetDbForTests();
  applyMigrations(dbPath);
});

afterEach(() => {
  resetDbForTests();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("match sync action", () => {
  it("creates and then updates matches by source and external id", async () => {
    const first = await syncMatches({
      sourceName: "browser-normalized",
      sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures",
      matches: [
        {
          externalId: "match-1",
          matchNumber: 1,
          stage: "Group Stage",
          groupName: "A",
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          kickoffAt: "2026-06-11T20:00:00Z",
          venue: "Estadio Azteca",
          status: "scheduled",
        },
      ],
    });

    expect(first.created).toBe(1);
    expect(first.updated).toBe(0);

    const second = await syncMatches({
      sourceName: "browser-normalized",
      matches: [
        {
          externalId: "match-1",
          stage: "小组赛",
          groupName: "A",
          homeTeam: "墨西哥",
          awayTeam: "南非",
          kickoffAt: "2026-06-11T20:00:00Z",
          status: "已完结",
        },
      ],
    });

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const row = getDb().select().from(matches).where(eq(matches.id, first.matchIds[0])).get();
    expect(row?.homeTeam).toBe("墨西哥");
    expect(row?.stage).toBe("group_stage");
    expect(row?.status).toBe("finished");
  });
});
