# 数据结构

## 赔率快照

Path: `data/manual/odds-snapshots.csv`

| 字段 | 含义 |
|---|---|
| `snapshot_id` | 稳定 id，例如 `odds-20260609-001`。 |
| `captured_at` | 带时区的 ISO 时间戳。 |
| `match_id` | 稳定比赛 id。 |
| `bookmaker` | Bet365、Betway、The Odds API 等。 |
| `market` | `1X2`、`spread`、`total`、`both_teams_score` 等。 |
| `selection` | 球队/平局/大/小/盘口方向。 |
| `line` | 让球或大小球盘口线；纯 `1X2` 可留空。 |
| `decimal_odds` | 十进制赔率。 |
| `source_note` | URL、截图名或手工说明。 |

## 持仓

Path: `data/bankroll/positions.csv`

| 字段 | 含义 |
|---|---|
| `position_id` | 稳定 id。 |
| `created_at` | 带时区的 ISO 时间戳。 |
| `mode` | `support`、`autonomous`、`parlay` 或 `pass`。 |
| `match_id` | 比赛 id；串关时可记录多个 leg。 |
| `market` | 市场名称。 |
| `selection` | 选择的结果。 |
| `stake` | 模拟下注金额。 |
| `odds` | 十进制赔率。 |
| `model_probability` | 模型概率，范围 0 到 1。 |
| `implied_probability` | 去水后或原始隐含概率，范围 0 到 1。 |
| `expected_value` | 期望值，使用小数比例。 |
| `confidence` | `low`、`medium` 或 `high`。 |
| `status` | `open`、`won`、`lost`、`void`、`cashout` 或 `pass`。 |
| `profit_loss` | 结算盈亏。 |
| `rationale` | 简短理由。 |
| `review_note` | 赛后复盘。 |

## 台账

Path: `data/bankroll/ledger.csv`

| 字段 | 含义 |
|---|---|
| `timestamp` | 带时区的 ISO 时间戳。 |
| `entry_type` | `initial_bankroll`、`stake`、`settlement`、`adjustment`。 |
| `amount` | 带正负号的金额。 |
| `balance` | 该条记录后的余额。 |
| `currency` | 模拟币种标签。 |
| `source` | 用户、Codex、结算等来源。 |
| `notes` | 审计备注。 |
