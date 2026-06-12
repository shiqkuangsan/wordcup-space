import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "@/db/client";
import { matches, oddsSnapshots } from "@/db/schema";
import { syncReferenceOdds } from "@/server/actions/odds-sync";

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

function insertMatch(kickoffAt: string) {
  getDb()
    .insert(matches)
    .values({
      id: "match-1",
      competition: "世界杯",
      season: "2026",
      stage: "group_stage",
      homeTeam: "墨西哥",
      awayTeam: "南非",
      kickoffAt,
      status: "scheduled",
      dataSource: "worldcup2026-api",
      externalId: "worldcup2026-game-1",
      matchNumber: 1,
      groupName: "A",
    })
    .run();
}

beforeEach(() => {
  tempDir = mkdtempSync(path.join(os.tmpdir(), "odds-sync-test-"));
  dbPath = path.join(tempDir, "test.db");
  process.env.DATABASE_URL = dbPath;
  process.env.ODDS_SOURCE_FIXTURES_JSON = JSON.stringify([
    {
      kind: "espn-draftkings",
      matchNumber: 1,
      eventId: 1001,
    },
    {
      kind: "html-american",
      matchNumber: 1,
      bookmaker: "bet365",
      sourceLabel: "test bet365",
      sourceUrl: "https://example.test/bet365",
      selections: { home: "Mexico", away: "South Africa", draw: "Tie" },
    },
    {
      kind: "html-decimal",
      matchNumber: 1,
      bookmaker: "Betway",
      sourceLabel: "test Betway",
      sourceUrl: "https://example.test/betway",
      selections: { home: "Mexico", away: "South Africa" },
    },
  ]);
  resetDbForTests();
  applyMigrations(dbPath);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetDbForTests();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
  delete process.env.ODDS_SOURCE_FIXTURES_JSON;
});

describe("odds source sync", () => {
  it("records pre-kickoff DraftKings, bet365, and Betway odds snapshots", async () => {
    insertMatch("2026-06-11T19:00:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/events/1001/")) {
          return Response.json({
            items: [
              {
                provider: { name: "DraftKings" },
                homeTeamOdds: { current: { moneyLine: { decimal: 1.4 } } },
                awayTeamOdds: { current: { moneyLine: { decimal: 8 } } },
                drawOdds: { moneyLine: 350 },
              },
            ],
          });
        }
        if (url.endsWith("/bet365")) {
          return new Response("Mexico -250 Tie +350 South Africa +800", { status: 200 });
        }
        if (url.endsWith("/betway")) {
          return new Response("Mexico South Africa 1.40 4.50 8.00", { status: 200 });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const result = await syncReferenceOdds(new Date("2026-06-11T09:00:00.000Z"));

    expect(result.inserted).toBe(9);
    expect(result.errors).toEqual([]);
    expect(getDb().select().from(oddsSnapshots).all()).toHaveLength(9);
  });

  it("skips unchanged odds instead of writing duplicate snapshots", async () => {
    insertMatch("2026-06-11T19:00:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/events/1001/")) {
          return Response.json({
            items: [
              {
                provider: { name: "DraftKings" },
                homeTeamOdds: { current: { moneyLine: { decimal: 1.4 } } },
                awayTeamOdds: { current: { moneyLine: { decimal: 8 } } },
                drawOdds: { moneyLine: 350 },
              },
            ],
          });
        }
        if (url.endsWith("/bet365")) return new Response("Mexico -250 Tie +350 South Africa +800", { status: 200 });
        if (url.endsWith("/betway")) return new Response("Mexico South Africa 1.40 4.50 8.00", { status: 200 });
        return new Response("not found", { status: 404 });
      }),
    );

    await syncReferenceOdds(new Date("2026-06-11T09:00:00.000Z"));
    const result = await syncReferenceOdds(new Date("2026-06-11T09:05:00.000Z"));

    expect(result.inserted).toBe(0);
    expect(result.skipped).toEqual([
      { matchNumber: 1, bookmaker: "DraftKings", reason: "unchanged" },
      { matchNumber: 1, bookmaker: "bet365", reason: "unchanged" },
      { matchNumber: 1, bookmaker: "Betway", reason: "unchanged" },
    ]);
    expect(getDb().select().from(oddsSnapshots).all()).toHaveLength(9);
  });

  it("skips matches after kickoff without fetching odds", async () => {
    insertMatch("2026-06-11T09:00:00.000Z");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncReferenceOdds(new Date("2026-06-11T09:00:01.000Z"));

    expect(result.inserted).toBe(0);
    expect(result.skipped).toEqual([
      { matchNumber: 1, bookmaker: "DraftKings", reason: "kickoff reached" },
      { matchNumber: 1, bookmaker: "bet365", reason: "kickoff reached" },
      { matchNumber: 1, bookmaker: "Betway", reason: "kickoff reached" },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getDb().select().from(oddsSnapshots).all()).toHaveLength(0);
  });

  it("does not write partial rows when a provider parse fails", async () => {
    insertMatch("2026-06-11T19:00:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no usable odds here", { status: 200 })),
    );

    const result = await syncReferenceOdds(new Date("2026-06-11T09:00:00.000Z"));

    expect(result.inserted).toBe(0);
    expect(result.errors).toHaveLength(3);
    expect(getDb().select().from(oddsSnapshots).all()).toHaveLength(0);
  });
});
