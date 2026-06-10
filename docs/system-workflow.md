# 世界杯下注工作台流程

## 使用目标

- 记录 User 与 Codex 两套决策来源。
- 默认都是真实资金，只有明确标记为模拟时才是模拟记录。
- Codex 可以给建议，也可以在可行时通过 Chrome / Computer Use 操作；但只有确认下单成功后才生成注单并扣款。

## 用户视角全流程

这张图按你每天实际使用系统的顺序描述：先看今天有什么比赛，再补盘口，让系统和 Codex 辅助判断，最后记录是否下注、是否成交、如何结算和复盘。图里的“我”就是用户本人。

```mermaid
flowchart TD
  Start["我打开本地工作台"] --> Check["看 Dashboard：余额、敞口、待执行、近期注单"]
  Check --> Today["进比赛中心，按日期浏览近期比赛"]
  Today --> Sync{"赛程需要更新吗？"}
  Sync -- "是" --> SyncRun["系统自动同步公开赛程；失败就显示本地缓存"]
  Sync -- "否" --> Pick["挑一场想看的比赛"]
  SyncRun --> Pick
  Pick --> Detail["打开比赛详情"]

  Detail --> Odds{"这场有没有我看到的盘口？"}
  Odds -- "没有" --> AddOdds["从平台截图或文本录入盘口、赔率、来源时间"]
  Odds -- "有" --> ReviewOdds["检查盘口是否还是当前值"]
  AddOdds --> ReviewOdds
  ReviewOdds --> Ask{"我要怎么判断？"}

  Ask -- "我自己判断" --> UserDecision["记录 User 决策：理由、金额、赔率、风险"]
  Ask -- "让 Codex 分析" --> CodexDecision["Codex 给出概率、EV、风险和建议金额"]
  Ask -- "只观察" --> Watch["记录 wait/pass 原因，后续再看"]

  UserDecision --> Risk{"金额符合资金和风控吗？"}
  CodexDecision --> Risk
  Risk -- "不符合" --> Revise["降低金额、改市场，或放弃下注"]
  Risk -- "符合" --> Intent["生成下注意图，进入决策队列"]
  Revise --> Ask
  Watch --> ReviewLater["等待后续盘口或赛后复盘"]

  Intent --> Execute{"我要不要现在执行？"}
  Execute -- "不执行" --> KeepIntent["保留在决策队列，稍后处理"]
  Execute -- "用户手动下单" --> Manual["我去平台手动下单"]
  Execute -- "浏览器辅助" --> Assisted["用 Chrome / Computer Use 辅助执行"]

  Manual --> PriceCheck{"平台最终赔率变化超阈值吗？"}
  Assisted --> PriceCheck
  PriceCheck -- "超了" --> Recheck["回到比赛详情重新评估，不直接成交"]
  PriceCheck -- "没超" --> Filled{"平台确认成交了吗？"}
  Recheck --> Ask

  Filled -- "失败/取消" --> AttemptNote["记录失败原因：赔率变动、限额、取消、未下成"]
  Filled -- "成功" --> Slip["录入成交注单：平台、金额、最终赔率、确认号/截图备注"]
  Slip --> Debit["系统从对应账本扣 stake"]
  Debit --> OpenSlip["注单进入未结算池"]

  OpenSlip --> WaitResult["比赛结束后查看平台结算或比分"]
  WaitResult --> Settle{"结算结果是什么？"}
  Settle -- "赢" --> Win["记录赢：返还本金和盈利"]
  Settle -- "输" --> Lose["记录输：不再返还"]
  Settle -- "走水/取消" --> Void["记录退款：返还本金"]
  Settle -- "半赢/半输" --> Half["记录半注结算"]
  Settle -- "提前兑现" --> Cashout["记录平台兑现金额"]

  Win --> Ledger["资金账本更新余额和流水"]
  Lose --> Ledger
  Void --> Ledger
  Half --> Ledger
  Cashout --> Ledger

  Ledger --> Review["复盘：理由是否成立、盘口是否买贵、User/Codex 表现如何"]
  AttemptNote --> Review
  ReviewLater --> Review
  KeepIntent --> Check
  Review --> Dashboard["回到 Dashboard 看资金曲线、ROI、敞口和下一场"]
  Dashboard --> Today
```

## 每天怎么用

| 场景 | 你要做什么 | 系统帮你做什么 |
|---|---|---|
| 赛前浏览 | 打开 `/matches`，按日期挑比赛 | 自动检查赛程新鲜度，显示比赛、时间、场地和国旗 |
| 盘口记录 | 把平台上看到的盘口、赔率、时间录进去 | 保存为赔率快照，后续用于复盘盘口质量 |
| 决策 | 选择自己判断，或让 Codex 给建议 | 记录决策来源、理由、概率、EV、金额和风险 |
| 执行 | 到平台手动下单，或用浏览器辅助 | 记录执行尝试；赔率变化过大时要求复核 |
| 成交 | 平台确认下单成功后录入注单 | 扣对应 `user` 或 `codex` 账本的 stake |
| 赛后 | 按平台结果录入赢、输、走水、半赢半输或 cashout | 自动写结算和资金流水 |
| 复盘 | 看哪些判断有效、哪些盘口买贵了 | 汇总资金曲线、ROI、User vs Codex 和风险敞口 |

## 页面使用顺序

```mermaid
flowchart LR
  A["/ Dashboard<br/>先看余额、敞口、待执行"] --> B["/matches<br/>挑比赛"]
  B --> C["/matches/[id]<br/>录盘口、看单场"]
  C --> D["/intents<br/>管理下注意图"]
  D --> E["/bets<br/>确认成交与结算"]
  E --> F["/bankroll<br/>检查流水和余额"]
  F --> G["/ Dashboard<br/>看结果和下一步"]
  H["/settings<br/>维护平台账户、风控、赔率容忍"] -. "影响决策和执行" .-> D
```

## 系统背后的保障流程

下面这张图是内部数据如何支撑你的操作。日常使用时优先看上面的用户流程；这里用于解释为什么账本、注单和复盘能追溯。

```mermaid
flowchart TD
  subgraph Sources["数据来源"]
    SF["FIFA 官方赛程"]
    SO["OpenFootball 2026 JSON"]
    SA["API-Football / API-Sports"]
    SB["用户提供盘口截图或文本"]
    SC["浏览器辅助采集"]
    SR["平台结算结果 / 比分来源"]
  end

  subgraph Sync["数据同步与标准化"]
    S1["页面访问或 npm run sync:worldcup2026"]
    S2["标准化球队名、开球时间、场地、状态"]
    S3["upsert matches"]
    S4["录入 odds_snapshots"]
    S5["记录 source_note / source_url / captured_at"]
  end

  subgraph Desk["本地 Web 工作台"]
    P0["Dashboard / 总览"]
    P1["Matches / 比赛中心"]
    P2["Match detail / 比赛详情"]
    P3["Intents / 决策队列"]
    P4["Bets / 注单中心"]
    P5["Bankroll / 资金账本"]
    P6["Settings / 设置"]
  end

  subgraph Decision["决策阶段"]
    D1{"决策来源"}
    D2["User 决策"]
    D3["Codex 分析与建议"]
    D4{"风控检查"}
    D5["生成 bet_intent"]
    D6["记录 pass / wait / rationale"]
  end

  subgraph Execution["执行阶段"]
    E1{"执行方式"}
    E2["用户手动执行"]
    E3["Chrome / Computer Use 辅助"]
    E4["生成 execution_attempt"]
    E5{"最终赔率变化 < 6%"}
    E6["失败、取消或要求复核"]
    E7["确认成交"]
  end

  subgraph Slip["成交与持仓"]
    B1["生成 bet_slip"]
    B2["拆分 bet_slip_legs"]
    B3["写 ledger: stake_paid"]
    B4["更新 portfolio 可用余额"]
    B5["进入未结算池"]
  end

  subgraph Settlement["结算阶段"]
    T1["录入平台结算、比分或截图依据"]
    T2{"结算结果"}
    T3["won: 返还 stake * odds"]
    T4["lost: 不再返还"]
    T5["void / cancelled: 返还本金"]
    T6["half_won / half_lost: 按半注规则返还"]
    T7["cashout: 按兑现金额返还"]
    T8["写 settlement"]
    T9["写对应 settlement ledger"]
  end

  subgraph Review["复盘与统计"]
    R1["decision_review"]
    R2["资金曲线、ROI、回撤"]
    R3["User vs Codex 对比"]
    R4["盘口质量、CLV、模型校准"]
    R5["按球队、小组、市场、平台统计风险"]
  end

  SF -.->|官方校验| S2
  SO --> S1
  SA -.->|后续补充| S2
  S1 --> S2 --> S3 --> P1
  SB --> S4
  SC --> S4
  S4 --> S5 --> P2
  P0 --> P1
  P1 --> P2
  P2 --> D1
  P6 --> D4
  P5 --> D4

  D1 -- "user" --> D2
  D1 -- "codex" --> D3
  D2 --> D4
  D3 --> D4
  D4 -- "通过" --> D5 --> P3
  D4 -- "不通过或主动放弃" --> D6 --> R1

  P3 --> E1
  E1 -- "user_manual" --> E2
  E1 -- "browser_assist" --> E3
  E2 --> E4
  E3 --> E4
  E4 --> E5
  E5 -- "否" --> E6 --> P3
  E5 -- "是" --> E7 --> B1

  B1 --> B2
  B1 --> B3 --> B4 --> P5
  B1 --> B5 --> P4

  SR --> T1
  P4 --> T1 --> T2
  T2 -- "won" --> T3
  T2 -- "lost" --> T4
  T2 -- "void / cancelled" --> T5
  T2 -- "half result" --> T6
  T2 -- "cashout" --> T7
  T3 --> T8
  T4 --> T8
  T5 --> T8
  T6 --> T8
  T7 --> T8
  T8 --> T9 --> P5
  T8 --> R1

  P5 --> R2
  R1 --> R3
  R1 --> R4
  R1 --> R5
  R2 --> P0
  R3 --> P0
```

## 关键数据流

| 阶段 | 主要输入 | 写入表 | 资金影响 |
|---|---|---|---|
| 赛程同步 | FIFA / OpenFootball / API provider | `matches`、`match_results` | 无 |
| 赔率快照 | 用户文本、截图、浏览器采集 | `odds_snapshots` | 无 |
| 决策 | 比赛、盘口、概率、理由、风控 | `bet_intents`、`bet_intent_legs` | 无 |
| 执行尝试 | 执行方式、观察赔率、失败原因 | `execution_attempts` | 无 |
| 成交确认 | 平台账户、stake、最终赔率、确认号 | `bet_slips`、`bet_slip_legs`、`portfolio_ledger_entries` | 扣 stake |
| 结算 | 平台结算、比分、截图或用户口述 | `settlements`、`portfolio_ledger_entries` | 按结算结果返还 |
| 复盘 | 结果、盘口变化、模型判断 | `decision_reviews` | 无 |

## 页面到流程映射

| 页面 | 当前职责 |
|---|---|
| `/` Dashboard | 汇总余额、未结算敞口、近期流水、最近注单 |
| `/matches` 比赛中心 | 自动检查赛程新鲜度，按日期查看比赛池 |
| `/matches/[id]` 比赛详情 | 查看单场比赛，录入盘口快照，进入决策记录 |
| `/intents` 决策队列 | 管理 User/Codex 的下注意图和执行入口 |
| `/bets` 注单中心 | 查看成交注单，记录结算 |
| `/bankroll` 资金账本 | 管理 User/Codex 额度、查看资金流水 |
| `/settings` 设置 | 管理平台账户、风控参数、赔率容忍和模型配置 |

## 不变量

- `bet_intent` 不扣钱。
- `execution_attempt` 不扣钱。
- 只有 `bet_slip` 创建成功后才扣 stake。
- 只有 `settlement` 决定最终盈亏。
- `placed_by=user` 只表示执行人，不表示决策归属。
- `portfolio_id=user|codex` 决定资金归属。
- 默认 `is_real_money=true`；只有明确选择模拟时才是模拟记录。
- 赔率变化达到或超过容忍阈值时，必须回到决策复核，不能直接沿用旧 intent。

## 支持玩法

| 维度 | 当前支持 |
|---|---|
| 时间段 | 全场、半场 |
| 市场 | 胜平负、让球、大小球、第 N 个进球球队、串关 |
| 结算 | 赢、输、走水、半赢、半输、提前兑现、取消/无效 |

## 信息不完整时必须提示

创建或结算记录前，如果缺少这些信息，需要提示用户补充或标记为未知：

- 比赛：哪一场，或至少双方球队和开球时间。
- 市场：全场/半场，胜平负/让球/大小球/第 N 球/串关。
- 选择：买哪一边，例如阿根廷胜、大 2.5、第 1 球巴西。
- 金额、赔率、平台账户。
- 是否真实资金；默认真实。
- 平台注单号或截图备注。
- 结算依据：平台已结算、比分来源、截图或用户口述。

## 下注成功前不扣款

`bet_intent` 和 `execution_attempt` 都不改变资金。只有确认成交后生成 `bet_slip` 才扣款。
