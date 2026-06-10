# World Cup Provider and Agent Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate `rezarahiminia/worldcup2026` as a read-only World Cup data provider and `machina-sports/sports-skills` as a Codex-side research toolkit without moving AI or trading execution into the app runtime.

**Architecture:** Keep `wordcup-space` as the source of truth for matches, odds snapshots, intents, bet slips, settlements, and portfolio ledgers. Add a replaceable provider layer for `worldcup2026` data, and document a Codex analysis contract that can use agent skills but must hand off through existing dry-run APIs.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, SQLite, Vitest, Codex agent skills, external REST API.

---

### Task 1: Lock Provider Requirements

**Files:**
- Modify: `docs/provider-agent-integration.md`
- Modify: `.catpaw/reqs/2026-06-10-provider-agent-integration.md`

**Steps:**

1. Confirm `worldcup2026` remains read-only and cannot settle bets.
2. Confirm `sports-skills` is installed in the agent runtime only.
3. Record conflict rules: FIFA official > user-confirmed local record > provider feed.
4. Record no-vendor rule: no submodule, no copied external source in this repository.

**Verification:**

Run:

```bash
rg -n "vendor|submodule|worldcup2026|sports-skills|dryRun" docs .catpaw
```

Expected: docs state provider boundaries and dry-run handoff.

### Task 2: Add Provider Fixture Tests

**Files:**
- Create: `src/server/providers/worldcup2026-api.test.ts`
- Create: `src/server/providers/worldcup2026-api.ts`

**Steps:**

1. Write a fixture based on a minimal `/get/games` response with `id`, team names, group, type, stadium id, score, `finished`, `time_elapsed`, and date fields.
2. Test that group-stage games map to local match sync inputs with stable `externalId`.
3. Test that unknown or ambiguous kickoff timezone does not silently overwrite an existing kickoff.
4. Test that score fields are parsed but not converted into settlement data.

**Verification:**

Run:

```bash
npm test -- src/server/providers/worldcup2026-api.test.ts
```

Expected: failing before implementation, passing after provider mapping exists.

### Task 3: Implement Read-Only Provider

**Files:**
- Modify: `src/server/providers/worldcup2026-api.ts`
- Test: `src/server/providers/worldcup2026-api.test.ts`

**Steps:**

1. Add `WORLDCUP2026_API_BASE_URL` defaulting to `https://worldcup26.ir`.
2. Implement `fetchWorldCup2026Games`, `fetchWorldCup2026Teams`, `fetchWorldCup2026Groups`, and `fetchWorldCup2026Stadiums`.
3. Allow optional bearer token from env, but do not require it for read endpoints.
4. Normalize provider response into the existing `syncMatches` input shape.
5. Return source metadata and warnings instead of throwing on partial optional data.

**Verification:**

Run:

```bash
npm test -- src/server/providers/worldcup2026-api.test.ts
npm run lint
```

Expected: provider tests pass and lint has no new errors.

### Task 4: Add Sync Action and Script

**Files:**
- Create: `src/server/actions/worldcup2026-api-sync.ts`
- Create: `src/scripts/sync-worldcup-2026-api.ts`
- Modify: `package.json`
- Test: `src/server/actions/match-sync.test.ts`

**Steps:**

1. Implement `syncWorldCup2026ApiMatches()` using the provider and existing `syncMatches`.
2. Add `npm run sync:worldcup2026:api`.
3. Print created, updated, total, source name, fetched time, and warning count.
4. Ensure this script does not write odds, intents, slips, ledger entries, or settlements.

**Verification:**

Run:

```bash
npm test
npm run sync:worldcup2026:api
```

Expected: sync only changes `matches` and reports warnings clearly.

### Task 5: Document Codex Analysis Contract

**Files:**
- Create: `docs/codex-analysis-contract.md`
- Modify: `docs/local-api.md`
- Modify: `AGENTS.md`

**Steps:**

1. Define the structured JSON Codex must produce before creating an intent.
2. Document allowed external tools: local DB/API, `worldcup2026` provider, `sports-skills`, web verification.
3. Require `sources`, `dataQuality`, `modelProbability`, `fairOdds`, `expectedValue`, `riskTier`, and `recommendation`.
4. Require `dryRun: true` before writing a Codex intent.

**Verification:**

Run:

```bash
rg -n "dataQuality|modelProbability|dryRun|sports-skills|worldcup2026" docs AGENTS.md
```

Expected: the contract is discoverable from docs and project instructions.

### Task 6: Validate Agent Skill Availability Manually

**Files:**
- Modify: `docs/provider-agent-integration.md`

**Steps:**

1. Install or update only the needed agent skills:

```bash
npx skills add machina-sports/sports-skills@football-data --yes
npx skills add machina-sports/sports-skills@betting --yes
npx skills add machina-sports/sports-skills@markets --yes
```

2. Treat `world-cup` as optional premium skill.
3. Record failure modes and fallback behavior.

**Verification:**

Run:

```bash
which sports-skills || true
sports-skills betting convert_odds --odds=1.9 --from_format=decimal
```

Expected: betting math works locally, or docs explain fallback to manual calculation.

### Task 7: End-to-End Dry Run

**Files:**
- Test: `tests/e2e/phase-1.spec.ts`
- Modify only if UI contracts changed.

**Steps:**

1. Start the app.
2. Sync matches from OpenFootball.
3. Sync matches from `worldcup2026` provider.
4. Pick a match and create a Codex intent with `dryRun: true`.
5. Confirm no ledger entry or bet slip is created by analysis alone.

**Verification:**

Run:

```bash
npm test
npm run lint
npm run e2e
```

Expected: existing lifecycle remains intact; provider sync does not affect money records.
