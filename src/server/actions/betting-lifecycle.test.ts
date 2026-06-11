import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postBetSlip } from "@/app/api/bet-slips/route";
import { POST as postIntent } from "@/app/api/intents/route";
import { POST as postPlacedBet } from "@/app/api/placed-bets/route";
import { POST as postSettlement } from "@/app/api/settlements/route";
import { getDb, resetDbForTests } from "@/db/client";
import { betIntentLegs, betIntents, betSlipLegs, betSlips, executionAttempts, platformAccounts, portfolioLedgerEntries, portfolios, settlements } from "@/db/schema";
import { createBetSlipFromAttempt } from "@/server/actions/bet-slips";
import { createExecutionAttempt, markExecutionAttempt } from "@/server/actions/execution-attempts";
import { createBetIntent, addBetIntentLeg } from "@/server/actions/intents";
import { createMatch } from "@/server/actions/matches";
import { settleBetSlip } from "@/server/actions/settlements";

let tempDir: string;
let dbPath: string;

function applyMigration(databasePath: string) {
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
        allocatedBalanceCents: 100000,
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
    expect(rowCount(betSlipLegs)).toBe(1);
    expect(
      getDb().select().from(betSlipLegs).where(eq(betSlipLegs.betSlipId, slip.id)).get()?.matchId,
    ).toBe(match.id);

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

  it("previews API writes without mutating lifecycle data", async () => {
    const intentPreview = await postIntent(jsonRequest("/api/intents", {
      dryRun: true,
      portfolioId: "codex",
      decisionBy: "codex",
      mode: "single",
      market: "full_time:moneyline",
      stake: 10,
      odds: 1.9,
      riskTier: "normal",
      confidence: "medium",
      rationale: "dryRun 决策预览。",
      legs: [
        {
          matchId: "match-preview",
          market: "full_time:moneyline",
          selection: "主胜",
          intendedOdds: 1.9,
        },
      ],
    }));
    const intentJson = await intentPreview.json();

    expect(intentJson.ok).toBe(true);
    expect(intentJson.data.writes).toBe(false);
    expect(rowCount(betIntents)).toBe(0);

    const intent = await createBetIntent({
      portfolioId: "codex",
      decisionBy: "codex",
      mode: "single",
      market: "full_time:moneyline",
      intendedStakeCents: 1000,
      intendedTotalOdds: 1.9,
      riskTier: "normal",
      confidence: "medium",
      rationale: "用于注单 dryRun。",
    });
    const ledgerBeforeSlipPreview = rowCount(portfolioLedgerEntries);
    const betSlipPreview = await postBetSlip(jsonRequest("/api/bet-slips", {
      dryRun: true,
      betIntentId: intent.id,
      platformAccountId: "bet365-main",
      stake: 10,
      finalOdds: 1.9,
      observedOdds: 1.9,
      confirmationRef: "dry-run-ticket",
    }));
    const betSlipJson = await betSlipPreview.json();

    expect(betSlipJson.ok).toBe(true);
    expect(betSlipJson.data.writes).toBe(false);
    expect(rowCount(executionAttempts)).toBe(0);
    expect(rowCount(betSlips)).toBe(0);
    expect(rowCount(portfolioLedgerEntries)).toBe(ledgerBeforeSlipPreview);
    expect(codexBalance()).toBe(100000);

    const attempt = await createExecutionAttempt({
      betIntentId: intent.id,
      executionMethod: "user_manual",
      platformAccountId: "bet365-main",
      intendedOdds: 1.9,
      observedOdds: 1.9,
    });
    await markExecutionAttempt({ id: attempt.id, status: "succeeded", observedOdds: 1.9 });
    const slip = await createBetSlipFromAttempt({
      executionAttemptId: attempt.id,
      platformAccountId: "bet365-main",
      stakeCents: 1000,
      finalOdds: 1.9,
      confirmationRef: "real-ticket-before-settlement-preview",
    });
    const ledgerBeforeSettlementPreview = rowCount(portfolioLedgerEntries);
    const settlementPreview = await postSettlement(jsonRequest("/api/settlements", {
      dryRun: true,
      betSlipId: slip.id,
      result: "won",
      sourceNote: "dryRun 结算预览。",
    }));
    const settlementJson = await settlementPreview.json();

    expect(settlementJson.ok).toBe(true);
    expect(settlementJson.data.writes).toBe(false);
    expect(settlementJson.data.settlement.payoutCents).toBe(1900);
    expect(rowCount(settlements)).toBe(0);
    expect(rowCount(portfolioLedgerEntries)).toBe(ledgerBeforeSettlementPreview);
    expect(codexBalance()).toBe(99000);

    const invalidCashoutPreview = await postSettlement(jsonRequest("/api/settlements", {
      dryRun: true,
      betSlipId: slip.id,
      result: "cashout",
      sourceNote: "缺少提前兑现到账金额。",
    }));
    const invalidCashoutJson = await invalidCashoutPreview.json();

    expect(invalidCashoutJson.ok).toBe(false);
    expect(rowCount(settlements)).toBe(0);
    expect(rowCount(portfolioLedgerEntries)).toBe(ledgerBeforeSettlementPreview);
  });

  it("records a placed bet screenshot draft by creating intent, attempt, slip and ledger atomically", async () => {
    const match = await createMatch({
      stage: "小组赛",
      homeTeam: "墨西哥",
      awayTeam: "南非",
      kickoffAt: "2026-06-12T03:00:00+08:00",
    });
    const screenshotDraft = {
      portfolioId: "user",
      decisionBy: "user",
      mode: "single",
      matchId: match.id,
      market: "full_time:highest_scoring_half",
      selection: "下半场",
      stake: 50,
      finalOdds: 2.01,
      platformAccountId: "bet365-main",
      executionMethod: "user_manual",
      confirmationRef: "534480127048810501",
      sourceText: "手机截图：RMB 50 单注，下半场，进球最多的半场，墨西哥 vs 南非，赔率 2.01，赢取 100.50。",
    };

    const preview = await postPlacedBet(jsonRequest("/api/placed-bets", {
      ...screenshotDraft,
      dryRun: true,
    }));
    const previewJson = await preview.json();

    expect(previewJson.ok).toBe(true);
    expect(previewJson.data.writes).toBe(false);
    expect(previewJson.data.canCreate).toBe(true);
    expect(previewJson.data.slip.potentialReturnCents).toBe(10050);
    expect(rowCount(betIntents)).toBe(0);
    expect(rowCount(betSlips)).toBe(0);
    expect(codexBalance()).toBe(100000);

    const created = await postPlacedBet(jsonRequest("/api/placed-bets", screenshotDraft));
    const createdJson = await created.json();

    expect(createdJson.ok).toBe(true);
    expect(rowCount(betIntents)).toBe(1);
    expect(rowCount(betIntentLegs)).toBe(1);
    expect(rowCount(executionAttempts)).toBe(1);
    expect(rowCount(betSlips)).toBe(1);
    expect(rowCount(betSlipLegs)).toBe(1);
    expect(rowCount(portfolioLedgerEntries)).toBe(1);

    const userPortfolio = getDb()
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, "user"))
      .get();
    expect(userPortfolio?.allocatedBalanceCents).toBe(95000);
  });

  it("supports Hong Kong odds and text-only non-World-Cup matches", async () => {
    const draft = {
      portfolioId: "user",
      decisionBy: "user",
      mode: "single",
      matchText: "英超 测试主队 vs 测试客队",
      market: "full_time:moneyline",
      selection: "主胜",
      stake: 50,
      finalOdds: 1.01,
      oddsFormat: "hong_kong",
      platformAccountId: "bet365-main",
      executionMethod: "user_manual",
      confirmationRef: "hk-text-match-ticket",
      sourceText: "非世界杯比赛文本记录，港盘 1.01。",
    };

    const preview = await postPlacedBet(jsonRequest("/api/placed-bets", {
      ...draft,
      dryRun: true,
    }));
    const previewJson = await preview.json();

    expect(previewJson.ok).toBe(true);
    expect(previewJson.data.canCreate).toBe(true);
    expect(previewJson.data.match.title).toBe("英超 测试主队 vs 测试客队");
    expect(previewJson.data.slip.finalOdds).toBe(2.01);
    expect(previewJson.data.slip.potentialReturnCents).toBe(10050);

    const created = await postPlacedBet(jsonRequest("/api/placed-bets", draft));
    const createdJson = await created.json();

    expect(createdJson.ok).toBe(true);

    const slip = getDb().select().from(betSlips).where(eq(betSlips.confirmationRef, "hk-text-match-ticket")).get();
    expect(slip?.finalOdds).toBe(2.01);
    expect(slip?.oddsFormat).toBe("hong_kong");
    expect(slip?.rawOdds).toBe(1.01);

    const leg = getDb().select().from(betSlipLegs).where(eq(betSlipLegs.betSlipId, slip?.id ?? "")).get();
    expect(leg?.matchId).toBeNull();
    expect(leg?.matchText).toBe("英超 测试主队 vs 测试客队");
  });
});
