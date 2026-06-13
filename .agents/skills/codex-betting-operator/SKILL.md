---
name: codex-betting-operator
description: Use when Codex is acting as an autonomous World Cup betting operator in wordcup-space: choosing weekly matches, reading Betway odds from Chrome/screenshots, deciding markets/stakes/parlays, creating intents, recording slips, settling, or reviewing historical betting performance.
---

# Codex Betting Operator

This skill governs Codex autonomous betting decisions for `wordcup-space`.

## Prime Directive

Do not promote an observation into a bet decision until the evidence gate passes.

Score prediction and bet execution are separate decisions. A scoreline may guide
market research, but it is not by itself a betting edge. Correct-score markets,
draw bets, win-plus-condition bets, and other high-variance outcomes require
extra evidence beyond "the predicted score implies it." If the only reason to
bet is that the score prediction points there, default to `wait` or a very small
test stake.

Codex autonomous betting is portfolio-first and week-first. Do not optimize one
match in isolation. For any "what should Codex buy" request, first build the
current-week fixture and market pool, then decide:

- which matches are single-bet candidates;
- which matches are parlay leg candidates;
- which candidates should be passed or watched;
- whether Codex should buy no single, no parlay, or both;
- stake sizing and execution order across the whole week.

When a goal is active for weekly betting decisions, Codex must keep moving the
weekly analysis forward without waiting for the user to name each match. User
messages may redirect priorities, but they are not required for every candidate
review.

User and Codex are fully independent decision actors. A User bet never blocks,
reduces, or substitutes for a Codex bet. Codex may choose the same match, same
market, same selection, and same stake as User if Codex's own evidence gate and
risk rules pass.

Parlay legs are independent portfolio decisions. A parlay leg does not need to
also be bought as a single, and single-bet candidates do not constrain the parlay
pool. Codex may choose:

- a leg that is also bought as a single;
- a leg that is only used in a parlay;
- a different market from the same match than the single-bet market;
- no parlay, even when singles exist.

The only hard requirement is that each leg must have its own rationale, price,
minimum executable odds, and compatibility with the overall portfolio risk.

Codex may create:

- `wait` / observation: incomplete evidence, line watch, possible idea.
- `pass`: enough evidence to reject a bet.
- `bet`: actionable decision with stake and minimum acceptable odds.

Only `bet` may become a `bet_intent`. If an idea is uncertain, keep it as observation text or cancel the intent.

## Execution Confirmation

Codex may guide the user or operate Chrome to prepare a bet, but must stop before
the final submit/place-bet action. The final external submission requires the
user's explicit confirmation at action time. If execution succeeds, then record a
`bet_slip`; if execution fails or the user does not confirm, do not record a
slip.

## Betway Execution Hygiene

Betway execution is stateful and easy to pollute. Before every real-money
execution handoff, verify the visible betslip rather than trusting the last
browser action.

Required handoff checks:

- Match: each selected item must match the intended teams and kickoff time.
- Market: each selected item must match the intended market, selection, line,
  and odds format.
- Stake: the active tab must show the intended stake and the expected total
  stake. For parlays, single-bet stakes must not be active.
- Mode: parlays must be on the `串关` tab and show the expected `2串1` / leg
  count, not separate `单关` rows.
- Odds: final displayed odds must pass the intent's minimum executable odds and
  the 6% tolerance check.
- Submit: stop at `请下注` / `确认下注`; the user must click the final submit.

Common Betway pitfalls:

- Search results may return side markets such as `先开球`; do not click a search
  result until the match title, kickoff time, and market type are verified.
- Event cards and boosted/featured cards can auto-add unwanted selections such
  as `3串1增值`; if any non-target item appears in the betslip, remove it before
  continuing.
- After adding multiple legs, Betway may remain on `单关`. Switch to `串关` and
  confirm the parlay stake before handoff.
- Completed-bet receipts are not an active new betslip. Close or confirm the
  receipt before preparing the next bet.
- Amount inputs may ignore normal typing because of iframes or input overlays.
  Prefer the iframe input when operating Chrome, then verify the visible stake
  and potential return.
- Do not infer execution from a prepared betslip. Only record after the user
  provides a success page/screenshot, confirmation number, or explicit execution
  success.

After recording a parlay slip, verify `bet_slip_legs` store each leg's own final
odds. The parent `bet_slips.final_odds` stores total parlay odds; it must not be
copied onto every leg.

## Minimum Evidence Gate

Before a Codex autonomous bet, verify and summarize:

1. Current Betway price and odds format.
2. Market consensus or at least one independent odds reference.
3. Recent form for both teams.
4. Head-to-head record, with sample age and relevance called out.
5. Team news: injuries, suspensions, expected lineup, or explicitly "not confirmed".
6. Tactical/market rationale for the selected market, not only the match winner.
7. Main opposing evidence.
8. Stake, risk tier, minimum executable odds, and abandonment condition.

If any of items 1, 2, 3, or 5 is missing, default recommendation is `wait`, not `bet`.

## Odds Format Discipline

- Betway may display decimal, Hong Kong, or Malay odds.
- Do not record Malay odds as Hong Kong odds.
- Decimal odds include stake, e.g. `2.01`.
- Hong Kong positive odds convert to decimal as `raw + 1`.
- Malay positive odds convert like Hong Kong; Malay negative odds need explicit conversion before use.
- If the system cannot represent the observed format, record only a note or a converted decimal with source note naming the raw format.

## Weekly Operating Loop

For each week:

1. Build the fixture pool from local `matches`.
2. Collect current Betway odds for the week and note odds format per market.
3. Rank matches as `单场候选`, `串关腿候选`, `观察`, or `放弃`. Treat
   `单场候选` and `串关腿候选` as separate pools; do not derive one mechanically
   from the other.
4. For candidates, collect external context and pass the evidence gate.
5. Build a week portfolio plan: singles, parlays, stake budget, max daily loss, and execution windows.
6. Create intents only after the evidence gate passes and `/api/intents` dry run has no warnings.
7. Keep the remaining matches on a rolling watchlist. Creating one intent does
   not end the weekly scan; re-check unpriced, late-week, and line-watch matches
   before their execution windows.
8. After execution succeeds, record the bet slip; never book a slip before execution succeeds.
9. After settlement, update result and review decision quality.
10. At week end, review Codex ROI, hit rate, average odds, market mix, avoidable errors, and next-week rule changes.

When ranking matches, never use "User already bet this" as a skip reason. User
bets may be treated as additional context only, not as Codex exposure.

## Early-Stage Bankroll Discipline

The first week of a tournament is an information-gathering phase. Treat early
losses as process samples, not as reasons to chase. Until Codex has a meaningful
sample of settled bets by market type:

- Prefer 1%-3% of Codex bankroll for normal singles, even though the hard cap is
  higher.
- Use 5% parlay cap as a maximum, not a target. Parlays must be built from legs
  that each independently pass the evidence gate.
- Do not upgrade a high-odds market because it is emotionally attractive. Draws,
  correct scores, win-and-BTTS, and narrow total-goals ranges should be
  down-weighted unless team news, matchup shape, and market comparison all
  support the same thesis.
- Prefer market-shape edges when winner edges are weak. Examples: both teams to
  score, total goals, half-time tempo, or team goal direction can be better than
  forcing 1X2.
- For live betting, require a concrete trigger such as red card, injury,
  tactical dominance, shot/territory pressure, or abnormal odds movement. A live
  scoreline merely matching Codex's prediction is not enough.

## Self-Learning Loop

After each cancelled intent, failed execution, losing bet, or bad process:

- Identify whether the error was data, odds format, market selection, stake sizing, execution, or reasoning.
- Add a short durable lesson to project docs or `.catpaw/lessons.md` when it should affect future behavior.
- Do not hide mistakes; cancelled or passed decisions are part of the record.
- Prefer reducing future stake/grade when the same failure pattern repeats.
- For each settled losing bet, classify the failure as at least one of:
  data/lineup gap, market selection, price/odds error, execution issue,
  bankroll sizing, live-betting emotion, or normal variance.
- Weekly review must separate prediction accuracy from betting ROI. A good score
  prediction can still be a bad bet, and a losing bet can still be acceptable if
  the process and price were sound.

## Required Output For A Bet

Use this shape:

```text
Codex 决策：
比赛：
市场：
选择：
当前赔率与格式：
折合欧盘：
下注金额：
最低执行赔率：
证据摘要：
反方证据：
放弃条件：
```

If the output lacks the evidence摘要 or反方证据, it is not ready for execution.
