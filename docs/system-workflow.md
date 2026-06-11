# 世界杯下注工作台流程

## 使用目标

- 记录 User 与 Codex 两套决策来源。
- 默认都是真实资金，只有明确标记为模拟时才是模拟记录。
- Codex 可以给建议，也可以在可行时通过 Chrome / Computer Use 操作；但只有确认下单成功后才生成注单并扣款。

## 用户视角全流程

这张图按你每天实际使用系统的顺序描述：先看今天要处理什么，再进入单场比赛补盘口、让 Codex 辅助分析，最后记录是否下注、是否成交、如何结算和复盘。图里的“我”就是用户本人。

```mermaid
flowchart TD
  Start["我打开 Dashboard"] --> Command["每日作战台：今日比赛、重点待补盘口、待执行、待结算、风险敞口"]
  Command --> Need{"现在最该处理哪类事项？"}

  Need -- "先校验数据" --> Matches["进入比赛中心"]
  Matches --> Sync{"赛程来源、104 场数量、warnings 是否正常？"}
  Sync -- "需要更新" --> SyncRun["手动或 stale check 同步 provider 数据"]
  Sync -- "正常" --> Pick["按日期/来源挑比赛"]
  SyncRun --> Pick

  Need -- "处理重点待补盘口" --> Pick
  Need -- "处理待执行" --> IntentQueue["进入决策队列"]
  Need -- "处理待结算" --> BetsQueue["进入注单中心"]

  Pick --> Detail["打开单场工作台"]
  Detail --> NextAction["看下一步提示：待定价 / 待分析 / 待执行 / 等待赛果 / 待结算 / 待复盘"]

  NextAction --> Odds{"是否已有我实际看到的盘口？"}
  Odds -- "没有" --> AddOdds["从平台截图或文本录入 bookmaker、market、selection、line、odds、时间"]
  Odds -- "有" --> OddsMath["查看隐含概率、去水概率、公允赔率和 overround"]
  AddOdds --> OddsMath

  OddsMath --> Analysis{"需要 Codex 分析吗？"}
  Analysis -- "需要" --> CodexDraft["Codex 读取本地数据、provider、sports-skills，输出 sources/dataQuality/概率/EV/风险/反方证据"]
  CodexDraft --> DryRun["先 dryRun 预览 intent，不写真实记录"]
  DryRun --> Confirm{"我确认创建 intent 吗？"}
  Confirm -- "否" --> Pass["记录 pass/wait 或继续观察"]
  Confirm -- "是" --> Intent["正式创建 bet_intent"]
  Analysis -- "我自己判断" --> UserIntent["手动创建 User intent"]
  Analysis -- "只观察" --> Pass
  UserIntent --> Intent

  Intent --> IntentQueue
  IntentQueue --> Execute{"现在执行吗？"}
  Execute -- "先不执行" --> Command
  Execute -- "执行" --> Place["我去平台手动下单，或用浏览器辅助"]
  Place --> OddsMove{"最终赔率变化超阈值吗？"}
  OddsMove -- "超了" --> Recheck["回到单场工作台重新评估"]
  OddsMove -- "没超" --> Filled{"平台确认成交了吗？"}
  Recheck --> Detail
  Filled -- "失败/取消" --> AttemptNote["记录失败原因；不扣资金"]
  Filled -- "成功" --> Slip["录入成交 slip：平台、stake、最终赔率、确认号/截图备注"]
  Slip --> Debit["系统从 user 或 codex 账本扣 stake"]
  Debit --> OpenSlip["进入未结算注单池"]

  OpenSlip --> Result["provider score 或我手动记录赛果"]
  Result --> SettlementHint["系统提示可结算，但不自动改钱"]
  SettlementHint --> BetsQueue
  BetsQueue --> Settle{"我核对平台结算后选择结果"}
  Settle -- "赢" --> Win["返还本金和盈利"]
  Settle -- "输" --> Lose["不再返还"]
  Settle -- "走水/取消" --> Void["返还本金"]
  Settle -- "半赢/半输" --> Half["按半注规则返还"]
  Settle -- "cashout" --> Cashout["按平台兑现金额返还"]

  Win --> Ledger["资金账本写流水并更新余额"]
  Lose --> Ledger
  Void --> Ledger
  Half --> Ledger
  Cashout --> Ledger

  AttemptNote --> Review["复盘：数据质量、赔率质量、判断理由、执行质量、盈亏"]
  Pass --> Review
  Ledger --> Review
  Review --> Dashboard["回到 Dashboard 看 ROI、命中率、CLV、User vs Codex 和下一步"]
  Dashboard --> Command
```

## 每天怎么用

| 场景 | 你要做什么 | 系统帮你做什么 |
|---|---|---|
| 每日开局 | 打开 `/`，看今日比赛、重点待补盘口、待执行、待结算和风险敞口 | 把当天最需要处理的事项排出来 |
| 数据校验 | 打开 `/matches`，看来源、同步时间、104 场数量和 warnings | 同步 provider 数据；来源异常时不静默覆盖 |
| 盘口记录 | 进入 `/matches/[id]`，把平台上看到的盘口、赔率、时间录进去 | 保存赔率快照，并计算隐含概率、去水概率、公允赔率和 overround |
| Codex 分析 | 在单场工作台生成分析草稿 | 输出 sources、dataQuality、概率、EV、风险、建议和反方证据；先 dryRun |
| 决策确认 | 你确认 User 或 Codex intent 是否正式创建 | 只有确认后才写 `bet_intent`，观察或 pass 也留痕 |
| 执行 | 到平台手动下单，或用浏览器辅助 | 记录执行尝试；赔率变化过大时要求复核 |
| 成交 | 平台确认下单成功后录入注单 | 扣对应 `user` 或 `codex` 账本的 stake |
| 赛果提示 | provider score 或你手动记录赛果 | 只提示待结算，不自动结算或改动资金 |
| 赛后结算 | 核对平台后录入赢、输、走水、半赢半输或 cashout | 自动写结算和资金流水 |
| 复盘 | 看哪些判断有效、哪些盘口买贵了 | 汇总 ROI、命中率、CLV、概率校准、User vs Codex 和风险敞口 |

## 页面使用顺序

```mermaid
flowchart LR
  A["/ Dashboard<br/>每日作战台"] --> B["/matches<br/>数据来源、日期分组、比赛池"]
  B --> C["/matches/[id]<br/>单场事实、盘口、分析、下一步"]
  C --> D["/intents<br/>dryRun 后的正式决策、待执行队列"]
  D --> E["/bets<br/>成交 slip、未结算、结算入口"]
  E --> F["/bankroll<br/>账本流水、余额、真实/模拟标记"]
  F --> G["/ Dashboard<br/>复盘指标和下一步"]
  H["/settings<br/>平台账户、风控、赔率容忍、模型配置"] -. "影响分析和执行" .-> C
  H -. "影响执行" .-> D
```

## 系统背后的保障流程

下面这张图是内部数据如何支撑你的操作。日常使用时优先看上面的用户流程；这里用于解释为什么账本、注单和复盘能追溯。

```mermaid
flowchart TD
  subgraph Sources["数据来源"]
    SF["FIFA 官方赛程"]
    SO["OpenFootball 2026 JSON"]
    SW["worldcup2026 provider"]
    SA["API-Football / API-Sports"]
    SB["用户提供盘口截图或文本"]
    SS["sports-skills agent tools"]
    SC["浏览器辅助采集"]
    SR["平台结算结果 / 比分来源"]
  end

  subgraph Sync["数据同步与标准化"]
    S1["页面 stale check 或手动 sync"]
    S2["标准化球队名、开球时间、场地、状态"]
    S3["upsert matches"]
    S6["显示来源、同步时间、104 场数量和 warnings"]
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
    D3["Codex analysis JSON"]
    D7["dryRun 预览 intent"]
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
    T0["provider score 或手动赛果"]
    T1["提示待结算；用户核对平台"]
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
  SW --> S1
  SA -.->|后续补充| S2
  S1 --> S2 --> S3 --> S6 --> P1
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
  SS -.->|赔率数学、球队上下文、市场参考| D3
  D2 --> D4
  D3 --> D7 --> D4
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

  SR --> T0
  SW --> T0
  T0 --> T1
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
| 赛程同步 | FIFA / OpenFootball / worldcup2026 provider | `matches` | 无 |
| 赔率快照 | 用户文本、截图、浏览器采集 | `odds_snapshots` | 无 |
| Codex 分析 | 本地比赛、赔率、资金、provider、sports-skills | 不写库；先返回 analysis JSON 和 dryRun 预览 | 无 |
| 决策确认 | 比赛、盘口、概率、理由、风控、用户确认 | `bet_intents`、`bet_intent_legs` | 无 |
| 执行尝试 | 执行方式、观察赔率、失败原因 | `execution_attempts` | 无 |
| 成交确认 | 平台账户、stake、最终赔率、确认号 | `bet_slips`、`bet_slip_legs`、`portfolio_ledger_entries` | 扣 stake |
| 赛果提示 | provider score、手动赛果、平台状态 | `match_results` | 无 |
| 结算 | 用户核对后的平台结算、截图或口述 | `settlements`、`portfolio_ledger_entries` | 按结算结果返还 |
| 复盘 | 结果、盘口变化、模型判断 | `decision_reviews` | 无 |

## 页面到流程映射

| 页面 | 当前职责 |
|---|---|
| `/` Dashboard | 每日作战台：今日比赛、重点待补盘口、待执行、待结算、风险敞口和复盘指标 |
| `/matches` 比赛中心 | 查看同步面板、来源、warnings、104 场比赛池和日期分组 |
| `/matches/[id]` 比赛详情 | 单场工作台：事实、盘口、Codex 分析、下一步、赛果和待结算提示 |
| `/intents` 决策队列 | 管理 dryRun 确认后的 User/Codex 下注意图和执行入口 |
| `/bets` 注单中心 | 查看成交注单、未结算池和人工结算入口 |
| `/bankroll` 资金账本 | 管理 User/Codex 额度、查看资金流水 |
| `/settings` 设置 | 管理平台账户、风控参数、赔率容忍和模型配置 |

## 不变量

- `bet_intent` 不扣钱。
- `execution_attempt` 不扣钱。
- Codex analysis 和 `dryRun` 不写真实资金记录。
- 只有 `bet_slip` 创建成功后才扣 stake。
- 只有 `settlement` 决定最终盈亏。
- provider score 或自动比分同步只能提示待结算，不能自动结算注单。
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
