# Operating Playbook

## Mission

Use Codex to analyze every World Cup match, support the user's favorite-team decisions, and run an autonomous simulated betting book from an initial bankroll of `2000`.

## Match Workflow

Each match should move through these states:

| State | Meaning |
|---|---|
| `scheduled` | Fixture exists, no serious analysis yet. |
| `priced` | At least one bookmaker odds snapshot is recorded. |
| `analyzed` | Model probabilities and qualitative notes are recorded. |
| `decided` | Stake decision is made: bet, pass, watchlist, or parlay leg. |
| `settled` | Final result and bankroll impact are recorded. |
| `reviewed` | Decision quality review is complete. |

## Prediction Flow

Default first version:

1. Convert bookmaker odds to implied probabilities and remove vig.
2. Build a baseline market prior from the best available price.
3. Adjust with team strength, form, injuries, lineups, venue/travel/rest, tactical matchup, and tournament context.
4. Produce probabilities for supported markets: `1X2`, Asian handicap/spread, totals, and selected props only when data quality is strong.
5. Compare model probability to offered odds.
6. Decide stake with bankroll rules.
7. Record the decision before kickoff.
8. After settlement, record result, closing-line value, and review notes.

## Bankroll Rules

Initial simulated bankroll: `2000`.

| Rule | Default |
|---|---:|
| Normal single stake cap | `2%` bankroll |
| High-conviction single stake cap | `4%` bankroll |
| Parlay stake cap | `1%` bankroll |
| Daily loss cap | `8%` bankroll |
| Minimum edge to bet | `3%` expected value |
| Minimum data quality for autonomous bet | `medium` |

No chasing. A losing streak reduces risk; it does not justify larger stakes.

## Decision Modes

| Mode | Purpose | Rule |
|---|---|---|
| `support` | Help user decide whether to back a favorite team | Emphasize risk, fair price, emotional premium, and alternatives. |
| `autonomous` | Codex chooses simulated bets | Must obey bankroll rules and record rationale. |
| `parlay` | Simulated multi-leg bet | Only use small stakes and record correlation risk. |
| `pass` | No bet | A pass is a valid decision and should be counted. |

## Visualization Targets

- Bankroll curve and drawdown.
- ROI, yield, hit rate, and average odds.
- Exposure by team, group, market, and bookmaker.
- Model calibration: predicted probability bucket vs realized hit rate.
- Closing-line value by market and bookmaker.
- Match cards with pre-match rationale and post-match review.
- Parlay tree and correlation notes.

## AI Usage

AI can summarize news, compare teams, critique reasoning, and draft match notes. It must not invent data. Every data-backed claim should reference a recorded source or be marked as an assumption.
