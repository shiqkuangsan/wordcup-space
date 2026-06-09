# Data Sources

Last checked: 2026-06-09.

## Fixture and Tournament Data

| Priority | Source | Use | Notes |
|---|---|---|---|
| 1 | FIFA official match schedule | Ground-truth validation for dates, venues, teams, results | https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums |
| 2 | `openfootball/worldcup.json` | Open fixture baseline and historical World Cup data | https://github.com/openfootball/worldcup.json |
| 3 | WC26 MCP | AI-friendly team, venue, schedule, matchup, and news context | https://wc26.ai/ |
| 4 | API-Football / API-SPORTS | Fixtures, standings, lineups, events, team/player stats | https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports |

## Odds Data

| Priority | Source | Use | Notes |
|---|---|---|---|
| 1 | User-provided Bet365 / Betway snapshots | Authoritative odds actually seen by the user | Record timestamp, bookmaker, market, line, odds, and screenshot/source note. |
| 2 | The Odds API | Normalized multi-book odds and market comparison | https://theoddsapi.com/ |
| 3 | Browser-assisted capture | Fallback when odds are only available in a logged-in browser | Capture only what the user can legally access; store normalized values, not credentials. |
| 4 | Manual research | Context and sanity checks | Keep provenance in `source_note`. |

## Team Strength and Context

Useful enrichment dimensions:

- FIFA ranking and Elo-style team ratings.
- Recent competitive form and opponent strength.
- Squad list, injuries, suspensions, rotation, and likely lineups.
- Rest days, travel distance, venue climate, altitude, and kickoff local time.
- Tactical matchup notes and motivation/context.
- Market movement and closing-line value after odds change.

## Source Policy

- Official source wins over third-party data.
- Odds snapshots must be timestamped.
- Any prediction based on stale or missing data must mark `data_quality`.
- Browser-captured data should be reproducible enough to audit later.
- Do not commit secrets, cookies, screenshots containing account details, or paid-provider raw dumps unless explicitly cleared.
