---
name: wordcup-space
description: Use when operating this repository as a Codex-powered World Cup prediction, betting-analysis, bankroll, odds-capture, bet-slip, settlement, or review workspace. This is the umbrella skill for third-party Codex users after cloning the repo.
---

# Wordcup Space

Use this skill when the user wants to run this project inside Codex.

## Role

This project is a local World Cup prediction and betting decision workspace.
Codex acts as a research and operations assistant that can:

- maintain fixtures, odds snapshots, predictions, bet intents, bet slips, settlements, bankroll entries, and reviews;
- predict match scores before kickoff;
- analyze common football betting markets;
- propose singles and parlays under bankroll rules;
- parse user screenshots or manual bet confirmations into structured records;
- settle and review results after matches finish.

Codex must not submit real-money bets without the user. The final external bet
submission belongs to the human user in real-money mode.

Exception for local simulation/delegated execution: if the project owner clearly
states that the current bookmaker session is simulated, demo-only, fake-money, or
otherwise has no real-money consequence, and authorizes Codex to submit an exact
ticket or exact batch, Codex may complete the final submit action after verifying
the visible betslip.

## First Action In A New Clone

Before making predictions or betting decisions, check:

1. The repo root has `AGENTS.md` and `.agents/skills/`.
2. The app dependencies are installed: `pnpm install`.
3. The database exists and is migrated/seeded:
   - `pnpm db:migrate`
   - `pnpm db:seed`
4. The local app can run:
   - `pnpm dev` for development on port `3107`
   - `pnpm run run` for built local usage on port `3108`
5. The user has configured their own platform account, bankroll, and risk rules.

Do not assume the original maintainer's Betway account, balances, database,
screenshots, or API keys are available.

## Skill Routing

For score prediction work, use the repo-local skill:

```text
.agents/skills/codex-match-predictor/SKILL.md
```

For autonomous betting decisions, staking, parlays, Betway/BW odds reading,
execution hygiene, settlement review, or screenshots, use:

```text
.agents/skills/codex-betting-operator/SKILL.md
```

For matchday SABA/BW odds capture, use the orchestration command first:

```bash
pnpm sync:match-odds -- --date <YYYY-MM-DD> --scope common
pnpm sync:match-odds -- --date <YYYY-MM-DD> --scope common --write
```

This command runs the read-only SABA API and checks whether each match has broad
market coverage. If SABA only returns one market, treat the capture as
incomplete and use page-text fallback or another comparable odds source before
using the data for betting analysis.

For low-level SABA diagnostics, use:

```bash
pnpm capture:saba-odds -- --date <YYYY-MM-DD> --scope common
pnpm capture:saba-odds -- --date <YYYY-MM-DD> --scope common --write
```

Only use `--scope all` for archival coverage after confirming the higher row
count is desired:

```bash
pnpm capture:saba-odds -- --date <YYYY-MM-DD> --scope all --request-delay-ms 750
```

For text fallback from a copied bookmaker page:

```bash
pnpm capture:chrome-odds-text -- --match-id <id-or-match-number>
pnpm capture:bw-odds -- --match-id <id-or-match-number> --stdin --dry-run
pnpm capture:bw-odds -- --match-id <id-or-match-number> --stdin --write
```

When the logged-in BW/SABA page is already open in Chrome, use the Chrome
connector first. If `openTabs()` returns an empty list, do not immediately fall
back to AppleScript, screenshots, or unrelated browser tooling. First inspect
all available Chrome extension backends, select the one whose `openTabs()`
contains the Betway/SABA URL, and claim that exact tab. Only use OS-level
fallbacks after plainly reporting that no Chrome connector can see the target
tab and the user approves the fallback.

Use `capture:chrome-odds-text` first when the user has the logged-in BW/SABA
match detail page open in Chrome. It only copies page text into
`tmp/bw-odds/<date>/<matchNumber>.txt`; it does not click bookmaker controls.
Then rerun `sync:match-odds` with `--fallback-text-dir`.

For already-placed bet screenshots or manual confirmations:

```bash
pnpm record:placed-bet -- --input payload.json
pnpm record:placed-bet -- --input payload.json --write
```

Always dry-run before writing financial records unless the user has explicitly
approved the exact payload.

## Default Operating Loop

When the user says something like "analyze tomorrow's matches", "give me today's
bets", or "prepare the parlay plan", run this loop:

1. Read local fixtures for the requested date/week.
2. Read existing predictions, odds snapshots, open bet slips, and bankroll.
3. Refresh odds snapshots when possible.
4. Update or create score predictions before kickoff.
5. Build a separate betting plan:
   - singles;
   - ordinary parlays;
   - optional correct-score parlays;
   - pass/watch list.
6. Check bankroll and daily stake limits.
7. Present the execution plan with minimum acceptable odds.
8. After the user submits bets and provides confirmation, record bet slips.
9. After final scores, settle and review.

Prediction and betting are separate. A score prediction does not automatically
become a bet.

## Data Ownership Defaults

The project supports two decision actors:

| Actor | Use |
|---|---|
| `user` | Human user's own decisions, bets, bankroll, and review. |
| `codex` | Codex's autonomous decisions, budget, bets, and review. |

Default real-money records use:

```text
decision_by=<user|codex>
placed_by=user
portfolio_id=<user|codex>
platform_account_id=<user-configured-account>
is_real_money=true
```

If the local user wants simulation only, they must explicitly set
`isRealMoney=false`.

## Safety Rules

- Never record a real-money bet before external execution succeeds.
- In simulation/delegated execution, record the slip only after the site shows a
  successful receipt or confirmation number.
- Never treat a prepared betslip as a confirmed bet.
- Never use the original maintainer's credentials, account names, balances, or
  screenshots as another user's facts.
- Never print or store bookmaker visitor tokens, cookies, or AI API keys.
- If a match has already started, do not create a new pre-match prediction.
- If screenshot information is incomplete, ask for the missing match, market,
  selection, stake, odds, format, platform account, or confirmation reference.

## User-Facing Trigger Examples

Users can ask Codex:

```text
使用 wordcup-space，帮我初始化本地世界杯工作台。
```

```text
使用 wordcup-space，预测本周还没开赛的比赛比分。
```

```text
使用 wordcup-space，分析明天四场比赛，给出单关和串关计划。
```

```text
使用 wordcup-space，我发一张下注成功截图，你帮我 dry-run 录入。
```

```text
使用 wordcup-space，这几场出结果了，帮我结算和复盘。
```
