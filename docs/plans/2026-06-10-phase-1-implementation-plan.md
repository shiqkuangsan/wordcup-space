# Phase 1 Local Web System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first local Web MVP for reliable manual recording, settlement, bankroll tracking, and User vs Codex visibility.

**Architecture:** Scaffold a Next.js App Router application in the current repository, then add a SQLite database with Drizzle schema and domain services for bankroll, risk checks, bet lifecycle, and settlement. UI pages use shadcn/ui with a Vercel/Geist black-white theme; data mutations use Server Actions and validation through Zod.

**Tech Stack:** Next.js App Router, TypeScript, shadcn/ui, Tailwind CSS, SQLite, Drizzle ORM, Zod, React Hook Form, ECharts, Vitest, Playwright.

---

## Contract Gates

The following invariants must be protected by tests before UI polish:

- `bet_intent` never changes portfolio balance.
- `execution_attempt` never changes portfolio balance.
- `bet_slip` creation writes a `stake_paid` ledger entry and reduces available portfolio balance.
- `settlement_win` returns `stake * final_odds`; `settlement_loss` does not double-deduct stake; `settlement_void` returns stake.
- Codex can only spend from `portfolio_id=codex`, regardless of shared `platform_account`.
- `placed_by=user` never changes decision ownership.
- `odds_change_pct < 0.06` can proceed; `odds_change_pct >= 0.06` blocks execution and requires re-evaluation.
- Codex risk limits are hard caps: single `10%`, high confidence `20%`, parlay `5%`, max `7` legs, daily loss `40%`.

## Task 1: Scaffold Next.js App

**Files:**
- Create/modify: `package.json`
- Create/modify: `src/app/**`
- Create/modify: `src/components/**`
- Create/modify: `src/lib/**`
- Create/modify: `next.config.ts`
- Create/modify: `tsconfig.json`
- Create/modify: `postcss.config.mjs`
- Create/modify: `eslint.config.mjs`

**Step 1: Scaffold project**

Run:

```bash
npx create-next-app@latest . --yes --force --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm
```

Expected: Next.js app files are created without interactive prompts.

**Step 2: Initialize shadcn/ui**

Run:

```bash
npx shadcn@latest init -d --base radix
```

Expected: `components.json`, `src/lib/utils.ts`, and theme variables are created.

**Step 3: Add UI components**

Run:

```bash
npx shadcn@latest add button card table tabs dialog sheet badge dropdown-menu form input textarea select separator skeleton alert alert-dialog command
```

Expected: shadcn components appear under `src/components/ui/`.

**Step 4: Install runtime and test dependencies**

Run:

```bash
npm install drizzle-orm better-sqlite3 zod react-hook-form @hookform/resolvers echarts echarts-for-react next-themes lucide-react
npm install -D drizzle-kit vitest @vitest/ui @types/better-sqlite3 playwright
```

Expected: dependencies are added to `package.json`.

**Step 5: Fix Geist/Tailwind theme**

Modify `src/app/layout.tsx` so font variable classes are on `<html>`, not `<body>`.

Modify `src/app/globals.css` so `@theme inline` uses literal font names:

```css
--font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Geist Mono", "Geist Mono Fallback", ui-monospace, monospace;
```

**Step 6: Verify scaffold**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit 0.

**Step 7: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs components.json src
git commit -m "Scaffold local web app"
```

## Task 2: Add Database Schema and Seed

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `src/db/seed.ts`
- Create: `src/domain/constants.ts`
- Modify: `.gitignore`
- Modify: `package.json`

**Step 1: Add DB scripts**

Add scripts to `package.json`:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "tsx src/db/seed.ts",
  "test": "vitest run"
}
```

If `tsx` is missing, install it:

```bash
npm install -D tsx
```

**Step 2: Ignore local database**

Append to `.gitignore`:

```gitignore
local.db
local.db-*
drizzle/*.sqlite
```

**Step 3: Create Drizzle config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "local.db",
  },
});
```

**Step 4: Define schema**

Create `src/db/schema.ts` with tables:

- `platformAccounts`
- `portfolios`
- `portfolioLedgerEntries`
- `matches`
- `matchResults`
- `oddsSnapshots`
- `betIntents`
- `betIntentLegs`
- `executionAttempts`
- `betSlips`
- `betSlipLegs`
- `settlements`
- `decisionReviews`
- `riskProfiles`
- `appSettings`

Use integer cents for money fields: `amountCents`, `balanceAfterCents`, `stakeCents`, `payoutCents`, `profitLossCents`.

Use text enums for status fields first; do not over-model custom SQL enum constraints in v1.

**Step 5: Lazy DB client**

Create `src/db/client.ts` with lazy singleton initialization:

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!sqlite) sqlite = new Database(process.env.DATABASE_URL ?? "local.db");
  if (!db) db = drizzle(sqlite);
  return db;
}
```

**Step 6: Seed defaults**

Create `src/db/seed.ts` to insert:

- platform account: `bet365-main`
- portfolio: `user`
- portfolio: `codex`
- Codex initial allocation ledger entry: `allocation_initial`, `100000` cents, `isRealMoney=false`
- risk profile: single `0.10`, high confidence `0.20`, parlay `0.05`, max legs `7`, daily loss `0.40`
- app setting: odds tolerance `0.06`

**Step 7: Generate and migrate**

Run:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Expected: migration files are created, `local.db` exists, seed completes.

**Step 8: Commit**

```bash
git add .gitignore package.json package-lock.json drizzle.config.ts drizzle src/db src/domain
git commit -m "Add SQLite schema and seed data"
```

## Task 3: Implement Domain Services with Tests

**Files:**
- Create: `src/domain/money.ts`
- Create: `src/domain/risk.ts`
- Create: `src/domain/odds.ts`
- Create: `src/domain/ledger.ts`
- Create: `src/domain/bet-lifecycle.ts`
- Create: `src/domain/settlement.ts`
- Test: `src/domain/*.test.ts`

**Step 1: Money helpers**

Implement cents conversion and formatting in `src/domain/money.ts`.

Tests:

```ts
expect(toCents(1000)).toBe(100000);
expect(formatCny(123456)).toBe("1234.56");
```

**Step 2: Odds tolerance**

Implement:

```ts
export function getOddsChangePct(intendedOdds: number, observedOdds: number) {
  return Math.abs(observedOdds - intendedOdds) / intendedOdds;
}

export function isWithinOddsTolerance(intendedOdds: number, observedOdds: number, tolerance = 0.06) {
  return getOddsChangePct(intendedOdds, observedOdds) < tolerance;
}
```

Tests must prove `0.059999` passes and `0.06` blocks.

**Step 3: Risk checks**

Implement risk check function:

```ts
checkStakeRisk({
  portfolioBalanceCents,
  stakeCents,
  riskTier,
  mode,
  legsCount,
  dailyLossCents,
  riskProfile,
})
```

Tests:

- normal single at 10% passes; above 10% blocks.
- high confidence at 20% passes; above 20% blocks.
- parlay at 5% passes; above 5% blocks.
- 8 legs blocks.
- daily loss above 40% blocks.

**Step 4: Ledger helpers**

Implement pure functions to calculate next balance:

- `allocation_initial`
- `allocation_top_up`
- `allocation_withdrawal`
- `stake_paid`
- `settlement_win`
- `settlement_loss`
- `settlement_void`
- `cashout`
- `adjustment`

Tests must prove losing settlement does not double-deduct stake.

**Step 5: Lifecycle guards**

Implement guards:

- `canCreateBetSlip(executionAttempt)`
- `canSettleBetSlip(betSlip)`
- `canExpireIntent(intent)`

Tests:

- failed attempt cannot create bet slip.
- succeeded attempt can create bet slip.
- open bet slip can settle.
- settled bet slip cannot settle again.

**Step 6: Run tests**

Run:

```bash
npm test
```

Expected: all domain tests pass.

**Step 7: Commit**

```bash
git add src/domain package.json package-lock.json
git commit -m "Add bankroll and bet lifecycle domain logic"
```

## Task 4: Add Server Actions and Data Access

**Files:**
- Create: `src/server/actions/platform-accounts.ts`
- Create: `src/server/actions/portfolios.ts`
- Create: `src/server/actions/matches.ts`
- Create: `src/server/actions/odds.ts`
- Create: `src/server/actions/intents.ts`
- Create: `src/server/actions/execution-attempts.ts`
- Create: `src/server/actions/bet-slips.ts`
- Create: `src/server/actions/settlements.ts`
- Create: `src/server/queries/dashboard.ts`
- Create: `src/server/queries/matches.ts`
- Create: `src/server/queries/bets.ts`

**Step 1: Add Zod schemas**

Each mutation must validate input with Zod before writing.

Required create actions:

- create platform account
- adjust portfolio allocation
- create match
- add odds snapshot
- create bet intent
- add bet intent leg
- create execution attempt
- mark execution attempt succeeded/failed/cancelled
- create bet slip from succeeded attempt
- settle bet slip

**Step 2: Enforce lifecycle invariants in actions**

`createBetSlipFromAttempt` must:

- require succeeded execution attempt;
- require odds tolerance pass;
- write `bet_slips`;
- write `stake_paid` ledger entry;
- update portfolio balance.

`settleBetSlip` must:

- reject already-settled slips;
- write `settlements`;
- write corresponding ledger entry;
- update portfolio balance;
- update bet slip status.

**Step 3: Query dashboard summaries**

Implement dashboard query returning:

- User portfolio summary.
- Codex portfolio summary.
- Open bet slips.
- Today exposure.
- Recent ledger entries.
- Recent bet slips.

**Step 4: Test actions with a temp SQLite DB**

Create tests using a temporary SQLite file. At minimum:

- create intent does not change balance.
- failed attempt does not change balance.
- succeeded attempt + bet slip changes balance.
- settlement win changes balance correctly.

Run:

```bash
npm test
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/server src/domain src/db
git commit -m "Add server actions for betting lifecycle"
```

## Task 5: Build App Shell and Theme

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/app-sidebar.tsx`
- Create: `src/components/top-status-bar.tsx`
- Create: `src/components/theme-provider.tsx`
- Create: `src/components/theme-toggle.tsx`
- Create: `src/app/(app)/layout.tsx`

**Step 1: Add theme provider**

Use `next-themes` to support light/dark.

**Step 2: Create sidebar**

Navigation items:

- Dashboard
- 比赛中心
- 资金账本
- 决策队列
- 注单中心
- 设置

Use lucide icons.

**Step 3: Create top status bar**

Show:

- Codex balance.
- Open risk.
- Pending intents.
- Theme toggle.

**Step 4: Verify visual shell**

Run:

```bash
npm run build
```

Expected: build passes.

**Step 5: Commit**

```bash
git add src/app src/components
git commit -m "Add local app shell and theme"
```

## Task 6: Build Dashboard

**Files:**
- Create: `src/app/(app)/page.tsx`
- Create: `src/components/dashboard/portfolio-summary.tsx`
- Create: `src/components/dashboard/open-risk-table.tsx`
- Create: `src/components/dashboard/recent-bets-table.tsx`
- Create: `src/components/charts/balance-chart.tsx`

**Step 1: Server fetch dashboard data**

Use `getDashboardSummary()` from `src/server/queries/dashboard.ts`.

**Step 2: Build summary cards**

Cards:

- User balance / P&L.
- Codex balance / P&L.
- Open exposure.
- Today loss used.

**Step 3: Add tables**

Tables:

- Pending intents.
- Open bet slips.
- Recent settlements.

**Step 4: Add balance chart**

Use ECharts client component. Keep chart compact and monochrome with status colors only.

**Step 5: Verify**

Run:

```bash
npm run build
```

Expected: build passes and dashboard route renders.

**Step 6: Commit**

```bash
git add src/app src/components src/server
git commit -m "Build dashboard overview"
```

## Task 7: Build Matches and Odds Entry

**Files:**
- Create: `src/app/(app)/matches/page.tsx`
- Create: `src/app/(app)/matches/[id]/page.tsx`
- Create: `src/components/matches/match-form.tsx`
- Create: `src/components/matches/odds-entry-form.tsx`
- Create: `src/components/matches/match-detail-tabs.tsx`

**Step 1: Match list page**

Show matches with status, kickoff time, team names, odds count, intent count, open bet count.

**Step 2: Match create form**

Fields:

- competition
- season
- stage
- home team
- away team
- kickoff time
- venue

**Step 3: Match detail page**

Tabs:

- 赛前信息
- 赔率
- 决策
- 执行
- 注单
- 复盘

**Step 4: Odds entry form**

Fields:

- bookmaker
- market
- selection
- line
- decimal odds
- captured at
- source type
- source note

**Step 5: Verify**

Run:

```bash
npm run build
```

Expected: build passes.

**Step 6: Commit**

```bash
git add src/app src/components src/server
git commit -m "Add match and odds entry pages"
```

## Task 8: Build Intents and Execution Flow

**Files:**
- Create: `src/app/(app)/intents/page.tsx`
- Create: `src/components/intents/intent-form.tsx`
- Create: `src/components/intents/intent-card.tsx`
- Create: `src/components/intents/execution-attempt-form.tsx`
- Create: `src/components/intents/create-bet-slip-dialog.tsx`

**Step 1: Intent form**

Support single and parlay.

Fields:

- portfolio: user/codex
- decision_by
- mode
- intended stake
- intended total odds
- risk tier
- confidence
- rationale

**Step 2: Legs editor**

Support max 7 legs. Enforce in UI and server action.

**Step 3: Execution attempt form**

Fields:

- method: user_manual / chrome / computer_use / browser_capture
- platform account
- observed odds
- notes
- status

**Step 4: Create bet slip dialog**

Only enable when execution attempt succeeded and odds tolerance passes.

Required fields:

- final odds
- stake
- confirmation ref
- optional screenshot path
- is real money

**Step 5: Verify**

Run:

```bash
npm test
npm run build
```

Expected: tests and build pass.

**Step 6: Commit**

```bash
git add src/app src/components src/server src/domain
git commit -m "Add intent and execution workflow"
```

## Task 9: Build Bets, Settlement, and Bankroll Pages

**Files:**
- Create: `src/app/(app)/bets/page.tsx`
- Create: `src/app/(app)/bankroll/page.tsx`
- Create: `src/components/bets/bets-table.tsx`
- Create: `src/components/bets/settlement-dialog.tsx`
- Create: `src/components/bankroll/allocation-form.tsx`
- Create: `src/components/bankroll/ledger-table.tsx`

**Step 1: Bets page**

Filters:

- portfolio
- decision_by
- status
- is_real_money
- mode

**Step 2: Settlement dialog**

Support:

- won
- lost
- void
- cashout

Require source note and settled at timestamp.

**Step 3: Bankroll page**

Show User and Codex balances, ledger entries, and allocation form.

Allocation actions:

- initial allocation
- top up
- withdrawal
- adjustment

**Step 4: Verify**

Run:

```bash
npm test
npm run build
```

Expected: tests and build pass.

**Step 5: Commit**

```bash
git add src/app src/components src/server
git commit -m "Add bets settlement and bankroll pages"
```

## Task 10: Settings, Smoke Tests, and Browser Verification

**Files:**
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/components/settings/risk-profile-form.tsx`
- Create: `src/components/settings/platform-account-form.tsx`
- Create: `src/components/settings/app-settings-form.tsx`
- Create: `tests/e2e/phase-1.spec.ts`

**Step 1: Settings page**

Allow editing:

- platform accounts
- Codex risk limits
- odds tolerance
- model names as plain settings for future phase

**Step 2: Add E2E smoke test**

Playwright flow:

- open dashboard
- create match
- add odds
- create Codex intent
- mark execution succeeded
- create bet slip
- settle as win
- verify Codex balance changed correctly

**Step 3: Run local dev server**

Run:

```bash
npm run dev
```

Expected: app starts on local port.

**Step 4: Run browser verification**

Use Browser or Playwright to verify:

- dashboard renders in dark and light mode;
- match form works;
- bet lifecycle happy path works;
- no obvious text overlap on desktop and mobile viewport.

**Step 5: Final verification**

Run:

```bash
npm test
npm run build
```

Expected: tests and build pass.

**Step 6: Commit**

```bash
git add src tests package.json package-lock.json
git commit -m "Complete phase 1 local betting workspace"
```

## Phase 1 Acceptance Checklist

- User and Codex portfolios exist and are visually distinct.
- Codex allocation, top up, and withdrawal are recorded in ledger.
- Manual odds entry works.
- Bet intent can be created without changing balance.
- Failed execution attempt does not change balance.
- Successful bet slip deducts stake.
- Settlement updates balance correctly.
- Odds tolerance blocks `>= 6%` changes.
- Parlays support up to 7 legs.
- Dashboard shows User vs Codex summaries.
- App supports light/dark shadcn/Vercel style.
- `npm test` passes.
- `npm run build` passes.
- Browser verification passes on desktop and mobile.
