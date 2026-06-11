import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  appSettings,
  platformAccounts,
  portfolioLedgerEntries,
  portfolios,
  riskProfiles,
} from "@/db/schema";
import {
  DEFAULT_CODEX_ALLOCATION_CENTS,
  DEFAULT_CODEX_RISK_PROFILE,
  DEFAULT_CURRENCY,
  DEFAULT_ODDS_TOLERANCE,
} from "@/domain/constants";
import {
  DEFAULT_PLATFORM_ACCOUNT_ID,
  DEFAULT_PLATFORM_ACCOUNT_LABEL,
  DEFAULT_PLATFORM_ACCOUNT_NAME,
  DEFAULT_PLATFORM_PROVIDER,
} from "@/domain/platform-defaults";

const db = getDb();

function id(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

async function upsertDefaults() {
  db.insert(platformAccounts)
    .values({
      id: DEFAULT_PLATFORM_ACCOUNT_ID,
      name: DEFAULT_PLATFORM_ACCOUNT_NAME,
      provider: DEFAULT_PLATFORM_PROVIDER,
      accountLabel: DEFAULT_PLATFORM_ACCOUNT_LABEL,
      currency: DEFAULT_CURRENCY,
      notes: "真实平台账户，可同时承载 User 和 Codex 逻辑账本。",
    })
    .onConflictDoNothing()
    .run();

  db.insert(portfolios)
    .values([
      {
        id: "user",
        ownerActor: "user",
        name: "User",
        currency: DEFAULT_CURRENCY,
        allocatedBalanceCents: 0,
        notes: "用户自己的判断和投入。",
      },
      {
        id: "codex",
        ownerActor: "codex",
        name: "Codex",
        currency: DEFAULT_CURRENCY,
        allocatedBalanceCents: DEFAULT_CODEX_ALLOCATION_CENTS,
        notes: "Codex 独立逻辑额度，可由用户代执行真实下注。",
      },
    ])
    .onConflictDoNothing()
    .run();

  const existingCodexLedger = db
    .select()
    .from(portfolioLedgerEntries)
    .where(eq(portfolioLedgerEntries.id, "ledger-codex-initial"))
    .get();

  if (!existingCodexLedger) {
    db.insert(portfolioLedgerEntries)
      .values({
        id: "ledger-codex-initial",
        portfolioId: "codex",
        entryType: "allocation_initial",
        amountCents: DEFAULT_CODEX_ALLOCATION_CENTS,
        balanceAfterCents: DEFAULT_CODEX_ALLOCATION_CENTS,
        currency: DEFAULT_CURRENCY,
        isRealMoney: true,
        sourceActor: "user",
        notes: "Codex 初始建议额度，最终以用户实际分配为准。",
      })
      .run();
  }

  db.insert(riskProfiles)
    .values({
      id: "risk-codex-default",
      ownerActor: "codex",
      ...DEFAULT_CODEX_RISK_PROFILE,
    })
    .onConflictDoNothing()
    .run();

  db.insert(appSettings)
    .values([
      {
        key: "odds_tolerance_pct",
        value: String(DEFAULT_ODDS_TOLERANCE),
        notes: "赔率变化小于该值可继续执行；大于等于该值必须重新评估。",
      },
      {
        key: "model_primary",
        value: process.env.OPENAI_MODEL_PRIMARY ?? "gpt-5.5",
        notes: "Phase 2 AI 决策默认模型。",
      },
      {
        key: "model_fallback",
        value: process.env.OPENAI_MODEL_FALLBACK ?? "gpt-5.4",
        notes: "Phase 2 AI 决策 fallback 模型。",
      },
    ])
    .onConflictDoNothing()
    .run();
}

upsertDefaults();

console.log(`Seed complete: ${id("seed")}`);
