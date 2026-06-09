# 本地 Web 系统设计

日期：2026-06-10
状态：已确认设计

## 目标

建设一个本地 Web 系统，用于记录、分析、预测、执行记录、结算和复盘世界杯比赛相关决策。

系统要同时支持 User 和 Codex 两套决策来源。真实平台账户可以只有一个，实际下单执行人默认都是用户，但系统内部必须区分：

- 谁做决策：`decision_by=user|codex`
- 谁执行下单：`placed_by=user`
- 钱算谁的额度：`portfolio_id=user|codex`
- 是否真实资金：`is_real_money=true|false`
- 使用哪个平台账户：`platform_account`

Codex 可以被分配独立逻辑预算。例如初始 `1000` CNY。Codex 的输赢基于这笔预算滚动；用户可以中途追加额度，也可以提取额度。所有额度变化必须进入系统记录。

## 核心原则

真实平台账户是现实世界的钱包，`portfolio` 是系统里的逻辑预算池。

Codex 的资金虽然物理上和用户平台总余额放在一起，但系统里单独计算余额、盈亏、ROI、回撤和风险敞口。

只有真实成交注单才影响资金。下注意图和执行尝试都不扣钱。

## 资金模型

```text
真实平台账户余额
  └── 系统内逻辑账本 portfolio
        ├── user
        └── codex
```

Codex ledger entry 类型：

| 场景 | entry_type | 对 Codex 余额影响 |
|---|---|---:|
| 初始拨款 | `allocation_initial` | 增加 |
| 追加额度 | `allocation_top_up` | 增加 |
| 提取额度 | `allocation_withdrawal` | 减少 |
| 成功下单 | `stake_paid` | 减少 |
| 赢单结算 | `settlement_win` | 增加返还金额 |
| 输单结算 | `settlement_loss` | 不再扣钱 |
| void 退款 | `settlement_void` | 增加退回本金 |
| 提前兑现 | `cashout` | 增加兑现金额 |
| 手工修正 | `adjustment` | 必须写原因 |

下注成功时扣 stake，结算时按结果返还。

## 风控规则

Codex 风控上限：

| 类型 | 上限 |
|---|---:|
| 普通单场 | Codex 当前余额 `10%` |
| 高信心单场 | Codex 当前余额 `20%` |
| 串关 | Codex 当前余额 `5%` |
| 单张串关最多 legs | `7` |
| 单日最大亏损 | Codex 当前余额 `40%` |
| 高风险搏冷 | 完全允许，Codex 自主判断，只要不超过总风控 |

这些是硬上限，不是默认下注比例。Codex 每次下注仍应记录实际金额、风险等级和理由。

建议记录字段：

- `risk_tier`
- `stake_pct_of_portfolio`
- `daily_loss_used_pct`
- `max_allowed_stake`
- `risk_check_result`
- `risk_check_note`

## 下注生命周期

采用四段式下注生命周期：

```text
bet_intent
→ execution_attempt
→ bet_slip
→ settlement
→ decision_review
```

各阶段含义：

| 阶段 | 作用 | 是否影响资金 |
|---|---|---|
| `bet_intent` | User/Codex 的下注意图和理由 | 否 |
| `execution_attempt` | Chrome、Computer Use 或用户手动执行过程 | 否 |
| `bet_slip` | 平台确认成交后的注单 | 是 |
| `settlement` | 注单结算结果 | 是 |
| `decision_review` | 赛后复盘 | 否 |

关键不变量：

- `bet_intent` 不扣钱。
- `execution_attempt` 不扣钱。
- 只有 `bet_slip` 创建成功后才扣 stake。
- 只有 `settlement` 决定最终盈亏。
- `placed_by=user` 不代表用户决策，只代表用户执行。
- `portfolio_id=codex` 才算 Codex 额度。

## 赔率变化容忍

执行时最终赔率可能不同于决策时赔率。容忍规则：

```text
odds_change_pct = abs(final_odds - intended_odds) / intended_odds
```

当：

```text
odds_change_pct < 0.06
```

Codex 可以继续执行。

当：

```text
odds_change_pct >= 0.06
```

不能按原 intent 直接成交，必须重新评估。

## 串关设计

串关必须拆 legs 记录，不能只存一行文本。

| 表 | 作用 |
|---|---|
| `bet_intents` | 整张串关注意图 |
| `bet_intent_legs` | 意图阶段每一腿 |
| `bet_slips` | 成交后的串关注单 |
| `bet_slip_legs` | 成交后每一腿最终赔率和状态 |

这样可以复盘是哪一腿拖累结果，也能分析 Codex 在不同串关结构上的表现。

## 数据库表

第一版 SQLite 表：

| 分组 | 表 | 作用 |
|---|---|---|
| 账户/资金 | `platform_accounts` | 真实平台账户 |
| 账户/资金 | `portfolios` | 系统内逻辑预算池 |
| 账户/资金 | `portfolio_ledger_entries` | 额度和下注资金流水 |
| 比赛 | `matches` | 比赛基础信息 |
| 比赛 | `match_results` | 赛果和比分 |
| 赔率 | `odds_snapshots` | 盘口快照 |
| 决策 | `bet_intents` | 下注意图 |
| 决策 | `bet_intent_legs` | 意图 legs |
| 执行 | `execution_attempts` | 执行尝试 |
| 成交 | `bet_slips` | 成交注单 |
| 成交 | `bet_slip_legs` | 成交 legs |
| 结算 | `settlements` | 注单结算 |
| 复盘 | `decision_reviews` | 赛后复盘 |
| 配置 | `risk_profiles` | 风控参数 |
| 配置 | `app_settings` | 赔率容忍、模型配置等 |

## 本地 Web 页面

第一版页面：

| 页面 | 用途 |
|---|---|
| `/` Dashboard | 余额、P/L、未结算风险、今日比赛、最近注单 |
| `/matches` 比赛中心 | 比赛列表和状态 |
| `/matches/[id]` 比赛详情 | 赔率、intent、执行、注单、复盘 |
| `/bankroll` 资金账本 | Codex 追加/提取额度和资金流水 |
| `/intents` 决策队列 | 待执行、已过期、已成交 intent |
| `/bets` 注单中心 | 所有成交注单，支持筛选和结算 |
| `/settings` 设置 | 平台账户、风控参数、赔率容忍、模型配置 |

## UI 风格

- Next.js App Router。
- shadcn/ui。
- Vercel / Geist 风格。
- 支持 light/dark 黑白主题。
- 默认布局：左侧导航 + 顶部状态条 + 主内容区。
- 中文文案为主，字段 id 和状态值保留英文。
- 黑白灰为主，只用少量状态色表达赢、亏、风险、待执行。
- 使用 Card、Table、Tabs、Dialog、Sheet、Badge、Dropdown、Form 等 shadcn 组件。
- 图表优先使用 ECharts。

## 技术栈

| 层 | 选择 |
|---|---|
| Framework | Next.js App Router |
| UI | shadcn/ui |
| DB | SQLite |
| Schema | Drizzle ORM |
| Forms | React Hook Form + Zod |
| Charts | ECharts |
| AI | OpenAI-compatible API，默认 `gpt-5.5`，fallback `gpt-5.4` |

## 两阶段边界

### 第一阶段：可靠记账和人工可用

目标：系统能真实记录、结算、复盘。

必须完成：

- SQLite schema。
- shadcn 本地 Web。
- User/Codex 逻辑账本。
- Codex 初始分配、追加、提取。
- 手工赔率录入。
- `bet_intent → execution_attempt → bet_slip → settlement` 流程。
- 注单结算。
- Dashboard。
- 基础图表：资金曲线、User vs Codex、未结算风险敞口。

第一阶段成功标准：

用户给出一场比赛、盘口、下注结果后，系统能完整记录、结算，并在页面上看清 User 和 Codex 各自表现。

### 第二阶段：Codex 自动决策和数据自动化

目标：Codex 成为可审计的半自动决策主体。

包含：

- AI 决策生成。
- Codex 自主串关策略。
- Chrome / Computer Use 执行辅助。
- FIFA / openfootball / API-Football / The Odds API 接入。
- 自动赛果同步。
- CLV 和模型校准。
- 高级复盘。

## 设计结论

第一阶段先让系统成为可信账本和操作台；第二阶段再让 Codex 成为真正可审计的自主操盘手。
