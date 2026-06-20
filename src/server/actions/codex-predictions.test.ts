import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/db/client";
import { codexPredictions } from "@/db/schema";
import { buildScorelineModel } from "@/domain/prediction-model";
import { createMatch } from "@/server/actions/matches";
import { upsertCodexPrediction } from "@/server/actions/codex-predictions";

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
  tempDir = mkdtempSync(path.join(os.tmpdir(), "wordcup-prediction-test-"));
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

describe("codex predictions", () => {
  it("stores an optional model snapshot with prediction evidence", async () => {
    const match = await createMatch({
      stage: "group",
      homeTeam: "Portugal",
      awayTeam: "Congo DR",
      kickoffAt: "2026-06-18T01:00:00+08:00",
      dataSource: "test",
      externalId: "test-prediction-model",
      lastSyncedAt: "2026-06-17T08:00:00.000Z",
    });
    const modelSnapshot = buildScorelineModel({
      home: { name: "Portugal", rating: 1990 },
      away: { name: "Congo DR", rating: 1680 },
    });

    await upsertCodexPrediction({
      matchId: match.id,
      predictedHomeScore: 2,
      predictedAwayScore: 0,
      confidence: "medium",
      dataMode: "prior_analysis",
      rationale: "Model baseline plus tactical review.",
      riskNote: "Lineups unconfirmed.",
      modelSnapshot,
      sources: [{ title: "local scoreline model", note: modelSnapshot.modelVersion }],
      predictedAt: "2026-06-17T09:00:00.000Z",
    });

    const row = getDb().select().from(codexPredictions).get();
    const evidence = JSON.parse(row?.sourcesJson ?? "{}") as {
      sources: Array<{ title: string }>;
      modelSnapshot: typeof modelSnapshot;
    };

    expect(evidence.sources[0].title).toBe("local scoreline model");
    expect(evidence.modelSnapshot.mainPrediction).toMatchObject({
      outcome: "home_win",
      homeScore: 2,
      awayScore: 0,
    });
  });
});
