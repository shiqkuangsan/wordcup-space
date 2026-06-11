# 好用版 Roadmap

## Product Goal

`wordcup-space` 的好用版目标不是堆功能，而是让世界杯期间每天打开系统后自然知道下一步要做什么：

```text
今天看什么？
这场值不值得买？
我下了什么、风险多少？
赛后结果说明我判断有没有进步？
```

## Completion Bar

第一版好用完成标准：

- 打开 Dashboard 能看到今日比赛、待录盘口、待执行、待结算和风险敞口。
- 打开单场比赛能完成事实查看、盘口录入、Codex 分析、决策、成交入口和赛后复盘。
- Codex 的每个判断都有来源、数据质量、概率、赔率、EV、风险和反方证据。
- 只有 `bet_slip` 创建成功后扣 stake；只有 `settlement` 更新最终盈亏。
- 自动同步比分或数据源不会自动下注、自动结算或改动真实资金。

## Roadmap

| Phase | Name | Goal | Acceptance |
|---|---|---|---|
| P1 | 数据可见 | `/matches` 显示同步面板、来源、最后同步、104 场数量、warnings | 页面能确认 104 场是否齐、数据是否新、来源是否可信 |
| P2 | 单场工作台 | `/matches/[id]` 显示比赛事实、数据源、盘口、User/Codex 决策、注单和当前状态 | 打开任意比赛，不跳页面就知道下一步该录盘口、分析、执行还是结算 |
| P3 | 赔率分析 | 赔率快照自动算隐含概率、去水概率、公允赔率、EV，并支持多 bookmaker 对比 | 录入赔率后，页面直接显示盘口贵不贵 |
| P4 | Codex 分析草稿 | 单场生成 Codex analysis JSON，并调用 intent `dryRun` 预览 | Codex 分析可预览，返回 sources/dataQuality/probability/EV/risk 和 `intentPreview.writes:false` |
| P5 | 执行体验 | intent 到 bet slip 的流转更顺；赔率变化超阈值提示复核；截图/口述直录更好用 | 成交才扣款；失败/取消不影响资金 |
| P6 | 赛果与结算 | provider score 写入 `match_results`，提示可结算注单，结算仍需用户确认 | 比赛结束后知道哪些单待结算，但系统不会自动改钱 |
| P7 | 复盘 Dashboard | User vs Codex、ROI、命中率、平均赔率、CLV、概率校准、按球队/市场风险 | 能回答谁判断更好、好在哪、亏在哪 |
| P8 | 每日作战台 | 首页汇总今日比赛、盘口缺口、待执行、待结算、昨日复盘 | 每天只看首页就能安排优先级 |

## Work Order

```text
P1/P2 -> P3 -> P4 -> P5 -> P6 -> P7 -> P8
```

理由：

- P1/P2 先让数据和单场状态可见，这是后续分析与下注的地基。
- P3/P4 再把 Codex 的概率和 EV 变成可落库的决策。
- P5/P6 收紧真实资金闭环，避免下注和结算被外部数据误触发。
- P7/P8 最后提升长期复盘和每日使用效率。

## Non-Goals

- 不做自动真实下单。
- 不做自动真实资金结算。
- 不把 prediction market 价格当作真实胜率。
- 不把外部 provider 或 agent skills 变成 app runtime 的强依赖。
- 不优先做复杂模型训练；先把输入、决策和复盘链路跑顺。

## Global Acceptance Criteria

| Area | Criteria |
|---|---|
| Data | 104 场可同步；来源、同步时间和 warning 可见 |
| Analysis | Codex 判断包含 sources、dataQuality、probability、EV、risk 和反方证据 |
| Money | 只有成交注单和结算动作影响 ledger |
| Safety | 外部数据不能自动下注或自动结算 |
| UX | 每个页面都有明确下一步动作 |
| Review | 每张单能追溯当时盘口、理由、结果、盈亏和复盘 |
