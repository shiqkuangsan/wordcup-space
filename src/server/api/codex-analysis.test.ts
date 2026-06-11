import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postCodexPreview } from "@/app/api/analysis/codex-preview/route";
import { getDb, resetDbForTests } from "@/db/client";
import { betIntentLegs, betIntents } from "@/db/schema";
import { addOddsSnapshot } from "@/server/actions/odds";
import { createMatch } from "@/server/actions/matches";
import { buildCodexAnalysisPreview } from "@/server/api/codex-analysis";

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

function jsonRequest(pathname: string, body: Record<string, unknown>) {
  return new Request(`http://127.0.0.1:3107${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedMatchWithOdds() {
  const match = await createMatch({
    stage: "group",
    homeTeam: "Mexico",
    awayTeam: "Canada",
    kickoffAt: "2026-06-12T20:00:00+08:00",
    dataSource: "test",
    externalId: "test-match",
    lastSyncedAt: "2026-06-10T08:00:00.000Z",
  });
  const capturedAt = "2026-06-10T09:00:00.000Z";

  await addOddsSnapshot({
    matchId: match.id,
    bookmaker: "betway",
    market: "full_time:moneyline",
    selection: "Mexico",
    decimalOdds: 2,
    capturedAt,
    createdBy: "codex",
    sourceActor: "codex",
    sourceType: "manual",
    sourceNote: "test home",
  });
  await addOddsSnapshot({
    matchId: match.id,
    bookmaker: "betway",
    market: "full_time:moneyline",
    selection: "Draw",
    decimalOdds: 3.5,
    capturedAt,
    createdBy: "codex",
    sourceActor: "codex",
    sourceType: "manual",
    sourceNote: "test draw",
  });
  await addOddsSnapshot({
    matchId: match.id,
    bookmaker: "betway",
    market: "full_time:moneyline",
    selection: "Canada",
    decimalOdds: 4,
    capturedAt,
    createdBy: "codex",
    sourceActor: "codex",
    sourceType: "manual",
    sourceNote: "test away",
  });

  return match;
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

describe("Codex analysis preview", () => {
  it("builds a dry-run intent preview without mutating intent tables", async () => {
    const match = await seedMatchWithOdds();

    const preview = buildCodexAnalysisPreview({
      matchId: match.id,
      selection: "Mexico",
      modelProbability: 0.55,
      stake: 10,
    });

    expect(preview.writes).toBe(false);
    expect(preview.analysis.recommendation).toBe("bet");
    expect(preview.analysis.marketImpliedProbability).toBeCloseTo(0.5, 6);
    expect(preview.analysis.marketFairProbability).toBeCloseTo(0.482758, 5);
    expect(preview.analysis.expectedValue).toBeCloseTo(0.1, 6);
    expect(preview.intentPreview.writes).toBe(false);
    expect(preview.intentPreview.intent.status).toBe("proposed");
    expect(preview.intentPreview.intent.intendedStakeCents).toBe(1000);
    expect(preview.intentPreview.legs[0].matchId).toBe(match.id);
    expect(rowCount(betIntents)).toBe(0);
    expect(rowCount(betIntentLegs)).toBe(0);
  });

  it("keeps no-model previews as wait recommendations with warnings", async () => {
    const match = await seedMatchWithOdds();

    const response = await postCodexPreview(
      jsonRequest("/api/analysis/codex-preview", {
        dryRun: true,
        matchId: match.id,
        selection: "Mexico",
        stake: 10,
      }),
    );
    const json = await response.json();

    expect(json.ok).toBe(true);
    expect(json.data.writes).toBe(false);
    expect(json.data.analysis.recommendation).toBe("wait");
    expect(json.data.intentPreview.intent.status).toBe("draft");
    expect(json.data.analysis.modelProbability).toBeUndefined();
    expect(json.data.warnings).toContain("缺少 Codex 模型概率，只生成观察草稿，不建议直接执行。");
    expect(rowCount(betIntents)).toBe(0);
    expect(rowCount(betIntentLegs)).toBe(0);
  });
});
