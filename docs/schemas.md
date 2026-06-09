# 数据结构

## 通用归属字段

后续 SQLite 主表建议统一包含这些字段：

| 字段 | 含义 |
|---|---|
| `created_by` | 谁创建这条记录：`user`、`codex`、`system` 或 `importer`。 |
| `decision_by` | 这笔判断/下注是谁决策的：`user` 或 `codex`。 |
| `placed_by` | 谁实际执行下单；当前默认是 `user`。 |
| `portfolio_id` | 资金归属账本：`user` 或 `codex`；无资金含义的数据可留空。 |
| `platform_account` | 实际投注平台账户，例如 `bet365-main`；无实际平台时可留空。 |
| `is_real_money` | 是否真实资金：`true` 或 `false`。 |
| `source_actor` | 原始信息来自谁：用户、Codex、provider、浏览器采集等。 |
| `source_type` | 来源类型：`manual`、`browser_capture`、`api`、`model`、`settlement`。 |
| `visibility` | 后续 web 系统展示用，默认 `normal`；敏感来源可标记为 `private`。 |

核心设计：User 和 Codex 数据可以进入同一类表，但必须通过 `decision_by`、`portfolio_id`、`placed_by` 和 `is_real_money` 区分。这样即使真实平台账户只有一个，dashboard 也能横向对比并分别统计。

## 赔率快照

Path: `data/manual/odds-snapshots.csv`

| 字段 | 含义 |
|---|---|
| `snapshot_id` | 稳定 id，例如 `odds-20260609-001`。 |
| `captured_at` | 带时区的 ISO 时间戳。 |
| `match_id` | 稳定比赛 id。 |
| `bookmaker` | Bet365、Betway、The Odds API 等。 |
| `created_by` | 谁录入或采集这条赔率：`user`、`codex`、`importer`。 |
| `source_actor` | 赔率来源归属，例如 `user` 提供截图，或 `api` 返回数据。 |
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
| `created_by` | 谁创建持仓：`user` 或 `codex`。 |
| `portfolio_id` | 归属资金账本：`user` 或 `codex`。 |
| `decision_by` | 谁做出这笔下注决策：`user` 或 `codex`。 |
| `placed_by` | 谁实际执行下单；当前默认 `user`。 |
| `platform_account` | 实际投注平台账户，例如 `bet365-main`。 |
| `is_real_money` | 是否真实资金。Codex 决策也可能是 `true`，表示你代 Codex 用真实额度执行。 |
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
| `portfolio_id` | 资金账本：`user` 或 `codex`。 |
| `is_real_money` | 是否真实资金。 |
| `entry_type` | `initial_bankroll`、`stake`、`settlement`、`adjustment`。 |
| `amount` | 带正负号的金额。 |
| `balance` | 该条记录后的余额。 |
| `currency` | 模拟币种标签。 |
| `source` | 用户、Codex、结算等来源。 |
| `notes` | 审计备注。 |

## 账本

建议后续 SQLite 增加 `portfolios` 表：

| 字段 | 含义 |
|---|---|
| `portfolio_id` | 稳定 id，例如 `user`、`codex`。 |
| `owner_actor` | 账本归属：`user` 或 `codex`。 |
| `name` | 展示名称。 |
| `allocated_balance` | 你给该账本分配的额度；Codex 初始可先按约 `1000` 记录，最终以实际分配为准。 |
| `currency` | 币种。 |
| `default_is_real_money` | 该账本默认是否真实资金；单张注单仍可覆盖。 |
| `platform_account` | 默认执行平台账户；可以多个逻辑账本共用一个真实平台账户。 |
| `notes` | 备注。 |
