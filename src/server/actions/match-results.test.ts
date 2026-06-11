import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/db/client";
import { matches, matchResults, portfolioLedgerEntries, settlements } from "@/db/schema";
import { createMatch } from "@/server/actions/matches";
import { recordMatchResult } from "@/server/actions/match-results";

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

function rowCount(table: SQLiteTable) {
  return getDb().select().from(table).all().length;
}

beforeEach(() => {
  tempDir = mkdtempSync(path.join(os.tmpdir(), "wordcup-test-"));
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

describe("match results", () => {
  it("records final scores without settlement or ledger side effects", async () => {
    const match = await createMatch({
      stage: "group",
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      kickoffAt: "2026-06-12T03:00:00+08:00",
      status: "scheduled",
    });

    const result = await recordMatchResult({
      matchId: match.id,
      homeScore: 2,
      awayScore: 1,
      resultStatus: "finished",
      sourceActor: "importer",
      sourceNote: "provider final score",
    });
    const updatedMatch = getDb().select().from(matches).where(eq(matches.id, match.id)).get();

    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
    expect(updatedMatch?.status).toBe("finished");
    expect(rowCount(matchResults)).toBe(1);
    expect(rowCount(settlements)).toBe(0);
    expect(rowCount(portfolioLedgerEntries)).toBe(0);
  });
});
