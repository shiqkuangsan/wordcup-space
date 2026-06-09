import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/db/client";
import { platformAccounts, portfolios } from "@/db/schema";
import { createBetSlipFromAttempt } from "@/server/actions/bet-slips";
import { createExecutionAttempt, markExecutionAttempt } from "@/server/actions/execution-attempts";
import { createBetIntent, addBetIntentLeg } from "@/server/actions/intents";
import { createMatch } from "@/server/actions/matches";
import { settleBetSlip } from "@/server/actions/settlements";

let tempDir: string;
let dbPath: string;

function applyMigration(databasePath: string) {
  const sql = readFileSync(
    path.join(process.cwd(), "drizzle/0000_youthful_taskmaster.sql"),
    "utf8",
  );
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");

  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }

  sqlite.close();
}

function seedRequiredRows() {
  const db = getDb();

  db.insert(platformAccounts)
    .values({
      id: "bet365-main",
      name: "Bet365 主账户",
      provider: "bet365",
      accountLabel: "bet365-main",
      currency: "CNY",
    })
    .run();

  db.insert(portfolios)
    .values([
      {
        id: "user",
        ownerActor: "user",
        name: "User",
        currency: "CNY",
        allocatedBalanceCents: 0,
      },
      {
        id: "codex",
        ownerActor: "codex",
        name: "Codex",
        currency: "CNY",
        allocatedBalanceCents: 100000,
      },
    ])
    .run();
}

function codexBalance() {
  const portfolio = getDb()
    .select()
    .from(portfolios)
    .where(eq(portfolios.id, "codex"))
    .get();

  return portfolio?.allocatedBalanceCents;
}

beforeEach(() => {
  tempDir = mkdtempSync(path.join(os.tmpdir(), "wordcup-test-"));
  dbPath = path.join(tempDir, "test.db");
  process.env.DATABASE_URL = dbPath;
  resetDbForTests();
  applyMigration(dbPath);
  seedRequiredRows();
});

afterEach(() => {
  resetDbForTests();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("betting lifecycle actions", () => {
  it("does not change balance for intents or failed attempts, then deducts and settles correctly", async () => {
    const match = await createMatch({
      stage: "group",
      homeTeam: "Argentina",
      awayTeam: "Japan",
      kickoffAt: "2026-06-12T20:00:00+08:00",
    });
    const intent = await createBetIntent({
      portfolioId: "codex",
      decisionBy: "codex",
      mode: "single",
      market: "1X2",
      intendedStakeCents: 10000,
      intendedTotalOdds: 2,
      riskTier: "normal",
      confidence: "medium",
      rationale: "测试 Codex 单场下注生命周期。",
    });

    await addBetIntentLeg({
      betIntentId: intent.id,
      matchId: match.id,
      market: "1X2",
      selection: "Argentina",
      intendedOdds: 2,
      legOrder: 1,
    });

    expect(codexBalance()).toBe(100000);

    const failedAttempt = await createExecutionAttempt({
      betIntentId: intent.id,
      executionMethod: "user_manual",
      platformAccountId: "bet365-main",
      intendedOdds: 2,
      observedOdds: 2,
    });
    await markExecutionAttempt({
      id: failedAttempt.id,
      status: "failed",
      failureReason: "用户未完成下单。",
    });

    expect(codexBalance()).toBe(100000);

    const succeededAttempt = await createExecutionAttempt({
      betIntentId: intent.id,
      executionMethod: "user_manual",
      platformAccountId: "bet365-main",
      intendedOdds: 2,
      observedOdds: 1.9,
    });
    await markExecutionAttempt({
      id: succeededAttempt.id,
      status: "succeeded",
      observedOdds: 1.9,
    });
    const slip = await createBetSlipFromAttempt({
      executionAttemptId: succeededAttempt.id,
      platformAccountId: "bet365-main",
      stakeCents: 10000,
      finalOdds: 1.9,
      isRealMoney: true,
      confirmationRef: "ticket-1",
    });

    expect(codexBalance()).toBe(90000);

    const settlement = await settleBetSlip({
      betSlipId: slip.id,
      result: "won",
      sourceNote: "测试赛果同步。",
    });

    expect(settlement.payoutCents).toBe(19000);
    expect(codexBalance()).toBe(109000);
  });

  it("blocks bet slip creation when odds movement reaches tolerance", async () => {
    const intent = await createBetIntent({
      portfolioId: "codex",
      decisionBy: "codex",
      mode: "single",
      market: "1X2",
      intendedStakeCents: 10000,
      intendedTotalOdds: 2,
      riskTier: "normal",
      confidence: "medium",
      rationale: "测试赔率变化拦截。",
    });
    const attempt = await createExecutionAttempt({
      betIntentId: intent.id,
      executionMethod: "user_manual",
      platformAccountId: "bet365-main",
      intendedOdds: 2,
      observedOdds: 1.88,
    });
    await markExecutionAttempt({
      id: attempt.id,
      status: "succeeded",
      observedOdds: 1.88,
    });

    await expect(
      createBetSlipFromAttempt({
        executionAttemptId: attempt.id,
        platformAccountId: "bet365-main",
        stakeCents: 10000,
        finalOdds: 1.88,
      }),
    ).rejects.toThrow("execution attempt cannot create bet slip");
  });
});
