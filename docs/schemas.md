# Data Schemas

## Odds Snapshot

Path: `data/manual/odds-snapshots.csv`

| Field | Meaning |
|---|---|
| `snapshot_id` | Stable id, e.g. `odds-20260609-001`. |
| `captured_at` | ISO timestamp with timezone. |
| `match_id` | Stable fixture id. |
| `bookmaker` | Bet365, Betway, The Odds API, etc. |
| `market` | `1X2`, `spread`, `total`, `both_teams_score`, etc. |
| `selection` | Team/draw/over/under/line side. |
| `line` | Handicap or total line, blank for pure `1X2`. |
| `decimal_odds` | Decimal odds. |
| `source_note` | URL, screenshot name, or manual note. |

## Position

Path: `data/bankroll/positions.csv`

| Field | Meaning |
|---|---|
| `position_id` | Stable id. |
| `created_at` | ISO timestamp with timezone. |
| `mode` | `support`, `autonomous`, `parlay`, or `pass`. |
| `match_id` | Fixture id or comma-separated legs for parlay. |
| `market` | Market name. |
| `selection` | Selected outcome. |
| `stake` | Simulated stake. |
| `odds` | Decimal odds. |
| `model_probability` | Model probability from 0 to 1. |
| `implied_probability` | Vig-adjusted or raw implied probability from 0 to 1. |
| `expected_value` | Expected value as decimal ratio. |
| `confidence` | `low`, `medium`, or `high`. |
| `status` | `open`, `won`, `lost`, `void`, `cashout`, or `pass`. |
| `profit_loss` | Settled P/L. |
| `rationale` | Short reason. |
| `review_note` | Post-match review. |

## Ledger

Path: `data/bankroll/ledger.csv`

| Field | Meaning |
|---|---|
| `timestamp` | ISO timestamp with timezone. |
| `entry_type` | `initial_bankroll`, `stake`, `settlement`, `adjustment`. |
| `amount` | Signed amount. |
| `balance` | Balance after entry. |
| `currency` | Simulated currency label. |
| `source` | User, Codex, settlement, etc. |
| `notes` | Audit note. |
