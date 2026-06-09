# wordcup-space

World Cup match analysis, prediction, visualization, and simulated bankroll tracking.

This repository is for two workflows:

- Decision support for matches you personally care about.
- Codex-managed simulated betting decisions with an initial bankroll of `2000`.

The project is simulation-first. It can record real bookmaker odds and compare model probabilities to market prices, but it should not automate real-money betting or treat predictions as guarantees.

## Current Scope

- Track every World Cup match with fixture, team, venue, odds, model view, final decision, and result.
- Keep a clean simulated bankroll ledger starting from `2000`.
- Build toward dashboards for bankroll curve, ROI, calibration, exposure, closing-line value, and match-level reasoning.
- Use public/open data first, paid or browser-collected data only when useful and allowed.

## Data Strategy

See [docs/data-sources.md](/Users/zhuguidong/WorkSpace/PrivateSpace/wordcup-space/docs/data-sources.md:1).

Primary shape:

- Official schedule validation from FIFA.
- Open fixture baseline from `openfootball/worldcup.json`.
- API-Football or similar provider for fixtures, standings, injuries, lineups, and stats when API access is available.
- Odds from user-provided Bet365/Betway snapshots, The Odds API, or browser-assisted capture.

## Operating Rules

See [docs/operating-playbook.md](/Users/zhuguidong/WorkSpace/PrivateSpace/wordcup-space/docs/operating-playbook.md:1).

Key defaults:

- Initial simulated bankroll: `2000`.
- Single match stake cap: normally `2%` of bankroll; high-conviction cap `4%`.
- Parlay stake cap: `1%` of bankroll.
- Daily loss cap: `8%` of bankroll.
- Every recommendation must record probability, odds, expected value, stake, rationale, and post-match outcome.

## Repository Layout

```text
docs/                 Project strategy, schemas, and operating rules
data/manual/          User-entered odds and match notes
data/bankroll/        Simulated bankroll ledger and positions
data/raw/             Ignored provider/API dumps
data/processed/       Ignored normalized model inputs/outputs
data/exports/         Ignored dashboard/report exports
src/                  Future ingestion, modeling, and visualization code
```

## AI Configuration

Use `.env.example` as the template. Keep the real API key outside git.
