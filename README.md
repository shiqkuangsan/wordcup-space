# wordcup-space

世界杯赛事记录、分析、预测、可视化，以及模拟资金管理。

这个仓库主要服务两个目标：

- 辅助你判断喜欢的球队和具体比赛是否值得买。
- 记录 User 和 Codex 两套决策来源；执行下单的人默认都是 `user`。
- Codex 可以有独立额度，既可能是模拟资金，也可能是你代为执行的真实资金。

项目用于记录真实盘口赔率、决策来源、实际执行人、真实/模拟资金标记，并把模型概率和市场赔率做对比；不做真实下注自动化，也不把任何预测当成确定结果。

## 当前范围

- 记录每场世界杯比赛：赛程、球队、场地、赔率、模型观点、最终决策和赛果。
- 区分 `user` 和 `codex` 两个决策来源：谁做预测、谁负责额度、谁实际执行下单、是否真实资金都要记录清楚。
- 后续建设可视化 dashboard：资金曲线、ROI、概率校准、风险敞口、收盘线价值、单场比赛分析卡片。
- 优先使用公开/开放数据；付费数据或浏览器采集只在必要且允许时使用。

## 数据策略

参见 [docs/data-sources.md](/Users/zhuguidong/WorkSpace/PrivateSpace/wordcup-space/docs/data-sources.md:1)。

初始方向：

- 用 FIFA 官方赛程做最终校验。
- 用 `openfootball/worldcup.json` 作为开放赛程基础数据。
- 如果有 API key，用 API-Football 或类似服务补充赛程、积分、伤停、首发、技术统计。
- 赔率来源优先用你提供的 Bet365/Betway 截图或文本，也可以评估 The Odds API，必要时再用浏览器辅助采集。

## 操作规则

参见 [docs/operating-playbook.md](/Users/zhuguidong/WorkSpace/PrivateSpace/wordcup-space/docs/operating-playbook.md:1)。

关键默认值：

- Codex 可配置独立额度；初始建议额度约 `1000`，以你实际分配为准。
- 单场普通下注上限：资金的 `2%`；高信心上限：`4%`。
- 串关上限：资金的 `1%`。
- 单日亏损上限：资金的 `8%`。
- 每次推荐都必须记录概率、赔率、期望值、下注金额、理由和赛后结果。

## 仓库结构

```text
docs/                 项目策略、数据结构、操作规则
data/manual/          你手动提供或录入的赔率、比赛笔记
data/bankroll/        模拟资金台账和持仓记录
data/raw/             原始 API/provider 数据，默认不进 git
data/processed/       标准化后的模型输入/输出，默认不进 git
data/exports/         dashboard、图表、报告导出，默认不进 git
src/                  后续的数据抓取、建模、可视化代码
```

## AI 配置

使用 `.env.example` 作为模板。真实 API key 只放在本地环境变量或本地 `.env`，不要进 git。
