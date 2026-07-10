---
name: codex-betting-operator
description: Use when Codex is acting as an autonomous World Cup betting operator in wordcup-space: choosing weekly matches, reading Betway odds from Chrome/screenshots, deciding markets/stakes/parlays, hedging open slips, creating intents, recording slips, settling, or reviewing historical betting performance.
---

# Codex Betting Operator

This skill governs Codex autonomous betting decisions for `wordcup-space`.

## Prime Directive

Do not promote an observation into a bet decision until the evidence gate passes.

Score prediction and bet execution are separate decisions. Score prediction is a
tournament tracking task; betting is an autonomous portfolio task. A scoreline
may guide market research, but it is not the betting candidate pool and is not by
itself a betting edge. Do not limit betting decisions to markets implied by the
published score prediction. Build the betting pool from every playable match and
the common Betway market types, then use the prediction as only one input signal
inside that wider review.

Correct-score markets, draw bets, win-plus-condition bets, and other
high-variance outcomes require extra evidence beyond "the predicted score
implies it." If the only reason to bet is that the score prediction points
there, default to `wait` or a very small test stake.

Codex autonomous betting is portfolio-first and week-first. Do not optimize one
match in isolation. For any "what should Codex buy" request, first build the
current-week fixture and market pool, then decide:

- which matches are single-bet candidates;
- which matches are parlay leg candidates;
- which candidates should be passed or watched;
- whether Codex should buy no single, no parlay, or both;
- stake sizing and execution order across the whole week.

For daily execution, the work unit is "today's playable board", not "the matches
that already have Codex score predictions". Scan all available matches and the
common market families from `docs/betway-market-types.md`, including full-time
and half-time 1X2, handicap, totals, BTTS, team totals, Nth goal team, and parlay
legs. Codex may choose several singles, one or more parlays, or no bet at all,
as long as every selected market passes the evidence gate and portfolio risk
limits.

One match can produce more than one Codex bet. Do not assume a match has only one
ticket. If different markets pass independently, Codex may buy multiple singles
on the same match, use the same match in one or more parlays, or combine a single
and parlay exposure. Examples include one match having a totals single, a BTTS
single, and a different parlay leg. The requirement is not "one match, one bet";
the requirement is that each ticket has a distinct rationale, price, stake, and
failure mode, and that correlated downside is counted in the day portfolio.

Codex has discretion to use the daily risk capacity. Early-stage discipline
means avoiding forced or low-quality bets, not artificially restricting the day
to one tiny stake when several independent edges exist.
The inverse is also true: a matchday fixture list is not a purchase order. Do
not force one single from every match or one parlay leg from every match. If the
available prices are thin, the market is efficient, or the edge is mostly
narrative, pass. "No bet" is a valid completed betting decision.

When a goal is active for weekly betting decisions, Codex must keep moving the
weekly analysis forward without waiting for the user to name each match. User
messages may redirect priorities, but they are not required for every candidate
review.

User and Codex are fully independent decision actors. A User bet never blocks,
reduces, or substitutes for a Codex bet. Codex may choose the same match, same
market, same selection, and same stake as User if Codex's own evidence gate and
risk rules pass.

User suggestions are idea inputs, not execution instructions, unless the user
explicitly says to buy that exact market. When the user suggests a market family
such as half-time handicap or other Haiti markets, Codex must still evaluate
settlement shape, price, evidence, and portfolio fit independently.

Parlay legs are independent portfolio decisions. A parlay leg does not need to
also be bought as a single, and single-bet candidates do not constrain the parlay
pool. Codex may choose:

- a leg that is also bought as a single;
- a leg that is only used in a parlay;
- a different market from the same match than the single-bet market;
- no parlay, even when singles exist.

The only hard requirement is that each leg must have its own rationale, price,
minimum executable odds, and compatibility with the overall portfolio risk.

Codex may build a parlay package instead of a single parlay. A normal matchday
can include multiple independent parlays, such as 2-leg, 3-leg, and 4-leg
variants, when enough legs pass the evidence gate. Do not artificially restrict
the plan to one parlay if the board has several playable angles. For a parlay
package:

- every parlay must pass the per-slip parlay risk cap;
- total parlay exposure must fit the daily loss cap and the early-stage bankroll
  plan;
- avoid making all parlays depend on the same fragile match or market thesis;
- include at least one lower-variance 2-leg option when building 3-leg or 4-leg
  upside variants;
- clearly mark which parlays are core, small-test, or upside-only.
- Prefer the cleanest market expression for the thesis before choosing stake.
  A correct match read can still become a bad bet if expressed through a fragile
  full-time total, quarter handicap, or low-value favorite. Compare equivalent
  expressions such as half-time total vs full-time total, team total vs match
  total, handicap vs moneyline, and single vs parlay leg; select the one whose
  settlement path matches the evidence with the fewest unrelated failure modes.
- System parlays such as `4串11` are not the same as a single `4串1`. When a
  bookmaker ticket packages 2-leg, 3-leg, and 4-leg components under one order
  number, record or reason about each component separately. The order-level
  stake is the sum of component stakes, and the order-level `可赢金额` may be net
  profit rather than total return. For local recording, split into component
  slips using a shared confirmation prefix, for example `<order>-C01`, so partial
  settlement and bankroll math remain correct.
- When a system parlay component contains a void/push leg, settle the component
  at adjusted odds with that leg removed; do not mark the component as a full
  win at the original total odds. Example: a `-1` handicap that wins by exactly
  one goal is a push, so a 2-leg component becomes a single-leg return and a
  3-leg component becomes the product of the two remaining winning legs.

For each parlay execution package, include at least one correct-score parlay
candidate unless the market is unavailable or prices cannot be verified. A
correct-score parlay can be 2-leg or 3-leg, and the user may explicitly allow
more than one for a given session. Treat correct-score parlays as upside-only:
small stake, high variance, never a replacement for core singles or lower
variance parlays. Each correct-score leg still needs a published Codex score
prediction, visible Betway correct-score price, and a clear abandonment
condition.

Codex may create:

- `wait` / observation: incomplete evidence, line watch, possible idea.
- `pass`: enough evidence to reject a bet.
- `bet`: actionable decision with stake and minimum acceptable odds.

Only `bet` may become a `bet_intent`. If an idea is uncertain, keep it as observation text or cancel the intent.

## Execution Confirmation

Codex may guide the user or operate Chrome to prepare a bet. In real-money mode,
Codex must stop before the final submit/place-bet action unless the user is
actively handling the final confirmation.

Simulation / delegated execution exception: if the local project owner clearly
states that the current bookmaker session is simulated, demo-only, fake-money, or
otherwise has no real-money consequence, and explicitly authorizes Codex to
submit the exact ticket or exact batch, Codex may click the final
`请下注` / `确认下注` control. Before doing so, Codex must verify the visible
betslip match, market, selection, stake, total stake, odds format, and mode. If
the visible ticket differs from the requested ticket, stop and ask.

If execution succeeds, then record a `bet_slip`; if execution fails or the user
has not granted the simulation/delegated exception, do not record a slip.

Default real-money execution path: the user places Betway tickets manually from
Codex's written plan, then sends success screenshots or confirmation refs for
Codex to record. Chrome operation is for reading odds, locating markets, and at
most preparing one ticket at a time. In simulation/delegated mode, Codex may run
multi-ticket execution, but must clear or verify the betslip between tickets and
must stop on any receipt, stale selection, odds-change warning, mixed state, or
unexpected prompt.

## Betway Execution Hygiene

Betway execution is stateful and easy to pollute. Before every real-money
execution handoff, verify the visible betslip rather than trusting the last
browser action.

Before choosing or recording a Betway football market, consult
`docs/betway-market-types.md`. Use the documented system key for intents and
slips, and keep the original Betway display text in the rationale or source
note when a market is ambiguous.

For BW / 沙盟体育 / SABA pre-match odds capture, prefer the project command
documented in `docs/bw-odds-capture.md`.

Primary route:

```bash
pnpm sync:match-odds -- --date <local-date> --scope common
pnpm sync:match-odds -- --date <local-date> --scope common --write
```

Use `--scope common` for daily decisions. This orchestration command runs the
SABA visitor API and marks a match incomplete when the API only returns a thin
market set, such as a single full-time handicap. Do not treat a thin SABA result
as all available odds when the logged-in Betway/SABA page visibly has more
markets. Use page-text fallback or another comparable source before making
betting decisions from that match.

SABA may expose multiple main-looking events for the same two teams, especially
in knockout rounds. Examples include the normal match market and a `哪一队可晋级`
special market. Prefer the base league event with `Parentmatchid=0`, no league
suffix after ` - `, and the higher `MarketCount`. If a matched event has
`MarketCount=1` or the page title is a special market, treat it as the wrong
event and search the SABA pool again before writing odds.

For SABA football common markets, `BetTypeId=16` is half-time/full-time
combination (`full_time:half_full`), not half-time correct score. The actual
half-time correct score feed uses `BetTypeId=405`. If half/full-time is required
by the user, verify that the latest database snapshot contains
`full_time:half_full` before saying the common odds sync is complete.

When SABA's home/away order is reversed from the local `matches` row, team-name
selections such as moneyline and handicap can still be stored by team name, but
score selections must be flipped into the local match order before writing. Do
not use correct-score odds for betting analysis until this order check has
passed. Do not flip total-goals range labels such as `0-1`, `2-3`, or `4-6`;
those are goal-count buckets, not match scorelines.

Use `--scope all` only when raw
archival coverage is more important than UI cleanliness, because unknown SABA
markets are stored as `saba:<betTypeId>`.

Low-level SABA diagnostic route:

```bash
pnpm capture:saba-odds -- --date <local-date> --scope common
```

Fallback route:

```bash
pnpm capture:chrome-odds-text -- --match-id <id>
pnpm capture:bw-odds -- --match-id <id> --text-file <file> --dry-run
pbpaste | pnpm capture:bw-odds -- --match-id <id> --stdin --dry-run
```

When using Chrome for BW/SABA odds reading, there may be more than one Chrome
extension backend. Do not assume `agent.browsers.get("extension")` selected the
right browser instance. If `browser.user.openTabs()` does not show the visible
Betway tab, inspect all extension backends, choose the backend whose
`openTabs()` contains the target `baluquqy7k.com/cn/sports` tab, and claim that
tab. A wrong backend returning `openTabs=[]` is not evidence that Chrome is
unavailable.

`capture:chrome-odds-text` is the preferred logged-in-page fallback when the
user has opened the target BW/SABA match detail page in Chrome. It copies
visible page text to `tmp/bw-odds/<date>/<matchNumber>.txt`, validates target
teams and market hints, and never clicks betting controls. After capture, rerun
`sync:match-odds` with `--fallback-text-dir`.

These commands are read-only with respect to the bookmaker page and only write
local `odds_snapshots` after the dry-run output looks structurally correct.
SABA visitor/odds tokens are runtime secrets: never print them, commit them, put
them in docs, or store them in database notes.

Odds capture is not complete until the local database proves coverage. After a
BW/SABA page-text capture, run the parser dry-run and check `parsedCount`,
distinct markets, and representative selections before `--write`. For a match
detail page, a result of `parsedCount=0`, one thin market, or only main-list
markets is a failed capture even if raw text exists. The expected detail capture
should include at least the common core markets when available: full-time and
half-time handicap, totals, 1X2, correct score, half-time correct score, second
half correct score, half/full-time, total goals, odd/even, BTTS-style markets,
double chance, clean sheet, and winning margin. Do not use incomplete odds for
betting analysis unless the missing markets are explicitly acknowledged and the
decision does not depend on them.

If BW/Betway navigation fails because of proxy, site errors, blank iframe
content, or console/network failures, stop the bookmaker capture loop. Do not
keep retrying AppleScript, screenshots, or page-copy commands against a broken
page, and do not write partial rows as if they were complete odds. Use one of
two explicit modes instead: `defer odds sync` when full Betway coverage is
required, or `fallback analysis` using public comparable odds sources with the
coverage limitation stated in the user-facing output and source notes.

When the BW shell loads but `/cn/sports/` remains on the homepage, page text is
empty, or direct resource fetches show TLS/socket resets, classify it as a
network/proxy access problem first. Then use SABA visitor API enumeration if it
still works, or ask the user to switch proxy/open the target detail page instead
of debugging the parser.

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
- Submit: in real-money mode, stop at `请下注` / `确认下注`; the user must click
  the final submit. In simulation/delegated mode, Codex may click final submit
  only after verifying the exact ticket and stake.

Common Betway pitfalls:

- Search results may return side markets such as `先开球`; do not click a search
  result until the match title, kickoff time, and market type are verified.
- The `赔率增值` homepage, `赛事串关` cards, and boosted combinations are not
  ordinary single-bet markets. Do not use their prices as normal 1X2, handicap,
  total, or BTTS prices.
- Event cards and boosted/featured cards can auto-add unwanted selections such
  as `3串1增值`; if any non-target item appears in the betslip, remove it before
  continuing.
- After adding multiple legs, Betway may remain on `单关`. Switch to `串关` and
  confirm the parlay stake before handoff.
- Completed-bet receipts are not an active new betslip. Close or confirm the
  receipt before preparing the next bet.
- If the page shows a completed receipt, old selections, boosted entries, or
  any unclear mixed state, stop Chrome execution and ask the user to place the
  next ticket manually or provide a fresh screenshot. Do not try to "clean up"
  by clicking around a live money betslip.
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
3. Group-stage qualification context when applicable: current points, goal
   difference, third-place path, final-round opponent, and whether the team
   needs a result or margin.
4. Recent form for both teams.
5. Head-to-head record, with sample age and relevance called out.
6. Team news: injuries, suspensions, expected lineup, or explicitly "not confirmed".
7. Tactical/market rationale for the selected market, not only the match winner.
8. Main opposing evidence.
9. Stake, risk tier, minimum executable odds, and abandonment condition.

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

- Size by bankroll percentage and confidence, not by fixed round numbers such as
  10, 20, or 30 RMB. Those are historical test stakes, not a default ceiling.
- Prefer 1%-5% of Codex bankroll for normal singles during early-stage sampling,
  even though the hard cap is higher. Use the lower end for uncertain ideas and
  the upper end when the evidence gate is clean and the price is still playable.
- High-confidence singles may use 5%-10% as a normal strong-conviction range and
  can go higher up to the configured high-confidence cap when evidence, price,
  and portfolio exposure justify it. A 50 RMB ticket can be normal when the
  current Codex bankroll makes it a modest percentage.
- Use 5% parlay cap as a maximum, not a target. Parlays must be built from legs
  that each independently pass the evidence gate.
- For a parlay package, split exposure across core, small-test, and upside-only
  tickets. Several 2-leg/3-leg/4-leg parlays are allowed if the package does not
  exceed daily loss discipline or concentrate on one fragile assumption.
- Daily total stake is capped at 25% of Codex's bankroll at the start of that
  matchday. Count all Codex real-money tickets for that day: singles, parlays,
  live bets, pending betslips, and already submitted slips. This stake cap is a
  hard guard before the larger daily loss cap; unused room is not carried over.
- Avoid anchoring stakes to cute denominations. Use amounts like 35, 45, 50, 65,
  or 80 when the bankroll percentage and confidence tier call for them.
- Do not fill the daily 25% stake cap just because it exists. The cap is a
  maximum loss guard, not a target budget. If only one market clears the gate,
  buy one; if none clears, buy none.
- Treat low-return favorites and low-odds safety legs with suspicion. Odds below
  roughly 1.70 need a clear edge, clean settlement shape, and enough portfolio
  value to justify real-money risk. Do not use several low-odds legs to make a
  plan look active.
- Favorite handicaps need a margin path, not just a winner read. Before using
  `-1`, `-2`, or `-2.5` as a core leg, state why the favorite should keep
  pressing after taking the lead: qualification margin, goal-difference
  incentive, opponent collapse risk, matchup overload, bench quality, or live
  pressure. If the evidence only says "stronger team should win", prefer
  moneyline/team total/half-time expression, reduce stake, or pass.
- Do not upgrade a high-odds market because it is emotionally attractive. Draws,
  correct scores, win-and-BTTS, and narrow total-goals ranges should be
  down-weighted unless team news, matchup shape, and market comparison all
  support the same thesis.
- Asian quarter/half lines need explicit settlement-shape review before they can
  become core singles. If the expected match path only produces a half win, such
  as under 2.25 needing exactly two goals or a half-time -0.75 needing a one-goal
  half-time lead, do not treat it as a strong-conviction expression. Prefer a
  cleaner line, reduce stake, move it to parlay/watch, or pass.
- Correct-score parlays are allowed as structured upside samples, especially
  when the user explicitly asks for them. They should normally use the published
  Codex score predictions, stay small relative to the parlay cap, and be tracked
  separately from core ROI judgment.
- When an exact-score read is close but misses by one goal, convert the lesson
  into market-shape learning instead of only calling it "wrong". For example, a
  `2-0` prediction becoming `3-0` and a `2-1` prediction becoming `2-0` both
  say the stronger team/control-and-clean-sheet thesis was better than the
  precise score. Future betting should prefer cleaner expressions such as
  favorite handicap, opponent team total under, clean sheet, or BTTS No when the
  market and team news support that cluster.
- Do not let many correct-score or exact-margin tickets crowd out the main
  portfolio thesis. Exact scores are useful as small upside samples and
  calibration data, but direction accuracy, market expression, and settlement
  shape must be reviewed separately from correct-score ROI.
- Prefer market-shape edges when winner edges are weak. Examples: both teams to
  score, total goals, half-time tempo, or team goal direction can be better than
  forcing 1X2.
- In World Cup group play, motivation is a market input, not a narrative extra.
  Matchweek two and three bets must account for the 2026 advancement format
  (top two plus eight best third-place teams), current table, goal difference,
  and final opponent. This can invalidate otherwise plausible totals or
  handicaps: a team needing margin may be a better handicap/over candidate,
  while two teams already well placed may protect a draw and weaken over bets.
- In the final group-round, convert motivation into a concrete target function
  before choosing a market:
  - `must win`: expect late risk, weaker clean-sheet assumptions, and possible
    over/live volatility;
  - `draw acceptable for both`: downgrade winner and over theses, consider draw
    or under only if the price is clean;
  - `first-place or goal-difference chase`: favorite handicaps/totals can be
    upgraded only when the team has reason to keep pressing after the first
    lead;
  - `already locked`: assume rotation/minute management until lineup proves
    otherwise; avoid deep handicaps and exact-score confidence;
  - `eliminated spoiler`: do not assume no effort, but require scoring evidence
    before using BTTS or overs.
- Final-round bets must state the knockout-path implication in the evidence
  summary. If the bet would only be attractive under a generic strength read but
  not under the team's actual table incentives, mark it `pass` or reduce it to a
  small parlay/watch leg.
- Treat half-time markets as first-class expressions, not side curiosities.
  When the evidence is about a cautious start, early tactical control, or a
  favorite asserting superiority before game state opens up, half-time totals or
  half-time handicaps can be cleaner than full-time markets. Do not generalize a
  half-time thesis into a full-time bet unless the late-match scoring and
  substitution risk are also part of the edge.
- In knockout matches, downgrade fragile draw and under theses when the match
  can be reshaped by late desperation, stoppage-time pressure, extra VAR checks,
  or technology-assisted decisions. A slow first 70 minutes is not enough to
  protect a narrow `1-1`/under path. Prefer totals with push/half-loss buffer,
  smaller stake, or a pass unless the favorite also lacks late attacking depth.
- For strong favorites with repeated clean sheets, high shot volume, or a clear
  full-back/pressing overload, do not underweight the margin path merely because
  the opponent is tactically competent. If the favorite has reason and ability
  to keep attacking after 1-0, `-1.5`, team total over, or BTTS No may be a
  cleaner expression than low-odds moneyline or exact 2-1.
- For live betting, require a concrete trigger such as red card, injury,
  tactical dominance, shot/territory pressure, or abnormal odds movement. A live
  scoreline merely matching Codex's prediction is not enough.
- Allow small contrarian bets when the original analysis starts failing in
  real time. A contrarian bet is not emotional revenge betting: it needs a
  visible trigger such as sustained pressure by the side Codex discounted,
  home/co-host energy, repeated failed entries by the favorite, lineup mismatch,
  market drift, or a score/tempo path that exposes the pre-match thesis. Keep
  the stake small, state the failed-thesis branch being bought, and do not let
  the contrarian ticket erase the original portfolio discipline.
- For live hedging, calculate at least two branches before judging the stake:
  the protected branch where the original tickets still win, and the adverse
  branch where the hedge wins while the original tickets lose. Use the hedge
  market's profit-only odds when Betway shows Hong Kong odds. A good defensive
  hedge can be slightly above the adverse-branch break-even stake when it locks
  in a small positive result while preserving most of the original upside.
- Live profit-locking windows are time-critical. When the user has a high-upside
  ticket that is still live and asks how to hedge, output the executable
  conclusion first: `buy X / stake A, buy Y / stake B, total stake C, minimum
  locked profit range, original-ticket upside if protected score hits`. Put
  formulas and discussion after the action list. Do not spend the first response
  on background explanation, broad analysis, or emotional reassurance.
- If the user asks for "stable profit", "lock profit", "对冲", "锁利", or
  similar language during a live match, treat it as an emergency execution
  request. Use the visible score, visible odds, original ticket stake/return,
  and platform balance already provided in the conversation; state assumptions
  inline, but do not wait for perfect bookkeeping before giving a stake table.
  If no complete lock is possible, say that immediately and present only the
  least-bad defensive option.
- Before proposing a hedge, compare the no-hedge baseline. State the original
  remaining exposure, worst-case loss if doing nothing, current upside if the
  original ticket hits, proposed hedge cost, and the new minimum result across
  all branches. If the original worst-case loss is tiny, such as a 10 RMB
  high-odds lottery ticket, do not spend hundreds to "protect" it unless a true
  all-branch lock exists. In that case, `do nothing / let it run` is the default
  professional answer.
- Distinguish true hedging from path coverage. A true hedge must cover every
  mutually exclusive result branch in the stated scope and produce the claimed
  floor after all new stakes. Buying several correct scores, selected 1X2
  outcomes, DNB/handicap alternatives, or totals is only partial protection
  unless uncovered scores and "other score" paths are also handled. Label these
  as `risk reduction`, not `stable profit`.
- For exact-score parlays, never imply that adding nearby scorelines creates a
  guaranteed hedge. First list the original winning score, all visible covered
  scorelines, "other score", and common live branches such as no more goals,
  one home goal, one away goal, and multiple late goals. If any feasible branch
  still loses both the original ticket and all hedge tickets, say `no stable
  win is available` before giving optional small-cover suggestions.
- Use an inverse-odds sanity check when trying to cover all standalone branches:
  if the sum of `1 / decimalOdds` for the full mutually exclusive coverage is
  above 1 and the original ticket does not pay on those branches, the hedge
  cannot guarantee profit by itself. Do not hide this behind stake tables.
- When an early parlay leg wins and a correct-score leg remains, treat the open
  slip as a contingent payout on that exact score. Do not start with a new match
  prediction or a directional single. First build the complete final-score
  state matrix using every open slip as an existing payout in the states where
  it wins. The branch result is:
  `existing payouts + new winning returns - all existing stakes - all new stakes`.
  "Every result has a winning ticket" is not enough; strict profit locking
  requires the minimum branch result to be positive.
- Do not assume a correct-score parlay offers useful cash out or an exchange lay.
  Check the actual ticket. If cash out is absent or priced below the objective,
  continue with the state matrix instead of repeatedly proposing it. A reverse
  correct-score price near `1.01` is normally unusable for meaningful locking;
  show the required stake and resulting floor once, then discard it.
- Expand combination markets into their exact state sets before using them. For
  example, `home/draw + under 2.5` covers only home wins or draws with zero, one,
  or two total goals. Verify the displayed threshold carefully: `under 1.5` and
  `under 2.5` are materially different branches. Never infer a market from its
  position in a screenshot.
- Compare overlapping combination markets against buying only the still-missing
  exact scores. For a target return `R`, a branch at decimal odds `O` costs
  `R / O`; separate mutually exclusive scores cost
  `R * sum(1 / scoreOdds)`. Existing high-payout scores are prepaid coverage, so
  a bundle that includes them can be less efficient than narrower score bets.
- If the user accepts one or more losing states, reclassify the plan as
  `weighted coverage`, not strict locking. Weight stakes only after calculating
  total portfolio cost, and publish one row per exhaustive state group with its
  total return and net P/L. Name every accepted negative state and its maximum
  loss; do not summarize it only as "win/draw/loss covered".
- A parlay leg from a later match does not lock profit on the current match. It
  adds another unresolved state dimension. Use later legs only as upside after
  the current-match floor is established, and never count their potential
  return as guaranteed recovery.
- If the user decides not to hedge, stop immediately: create no hedge intent,
  record no hedge slip, and preserve the computed state matrix as analysis only.
- Treat missed live hedges as process failures, not only bad luck. If a hedge
  window closes before execution because Codex delayed the conclusion, record
  the lesson and make the next live hedge response more direct. After the
  protected ticket is dead, stop calling the next bet a hedge; reclassify it as
  a rescue/chase bet, downsize sharply, and state that the original profit-lock
  opportunity is gone.
- When several hedge outcomes can cover the same adverse branch, prefer the
  smallest set of markets that covers all feasible final-score paths. For
  example, at `1-2` with an original `2-2` correct-score ticket, exact scores
  `1-2` and `1-3` plus over `4.5` can cover no-more-goal, one-away-goal, and
  any fifth-goal branch while preserving the original `2-2` upside.
- When User and Codex tickets share one platform account but separate ledgers,
  state which scope is being hedged. A hedge may be excessive for User-only
  exposure but correct for the combined practical exposure across User and Codex
  tickets.

## Self-Learning Loop

After each cancelled intent, failed execution, losing bet, or bad process:

- Identify whether the error was data, odds format, market selection, stake sizing, execution, or reasoning.
- Add a short durable lesson to project docs or `.catpaw/lessons.md` when it should affect future behavior.
- Also preserve positive lessons. If a live hedge, stake split, market choice, or
  execution pattern proves useful and repeatable, add it to the skill or
  operating playbook instead of only mentioning it in chat.
- When the user later reports a final platform balance after many unrecorded
  live bets, do not invent synthetic bet slips. Record match results, settle any
  real open slips that exist, then use a clearly labelled portfolio
  `adjustment` to align the ledger to the platform balance. The note must say
  that the adjustment covers unrecorded live/rescue bets and is not a fake slip.
- Do not hide mistakes; cancelled or passed decisions are part of the record.
- Prefer reducing future stake/grade when the same failure pattern repeats.
- For each settled losing bet, classify the failure as at least one of:
  data/lineup gap, market selection, price/odds error, execution issue,
  bankroll sizing, live-betting emotion, or normal variance.
- Weekly review must separate prediction accuracy from betting ROI. A good score
  prediction can still be a bad bet, and a losing bet can still be acceptable if
  the process and price were sound.

## Daily Matchday Handoff

When the user gives the day's matches, Codex owns the full loop. Do not require a
long daily discussion. Produce and execute the following sequence:

1. Confirm match list and available bankroll/risk room.
2. Refresh score predictions for each match before kickoff.
3. Scan Betway common markets for all matches, not only predicted outcomes.
4. Build a singles plan: buy, pass, or watch for each selected market.
5. Build a parlay plan separately: ordinary parlays and optional correct-score
   parlay candidates, with total stake room checked against the 25% daily cap.
6. Prepare the Betway betslip only for final approved candidates. In real-money
   mode, stop before `请下注` / `确认下注`; in simulation/delegated mode, Codex may
   submit after the exact-ticket checks pass.
7. After the user submits and shares success evidence, record the slips.

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
