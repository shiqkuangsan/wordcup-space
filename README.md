# wordcup-space

世界杯赛事记录、分析、预测、可视化，以及真实/模拟资金管理。

这个仓库主要服务两个目标：

- 辅助你判断喜欢的球队和具体比赛是否值得买。
- 记录 User 和 Codex 两套决策来源；执行下单的人默认都是 `user`。
- Codex 可以有独立额度，既可能是模拟资金，也可能是你代为执行的真实资金。

项目用于记录真实盘口赔率、决策来源、实际执行人、真实/模拟资金标记，并把模型概率和市场赔率做对比；不做真实下注自动化，也不把任何预测当成确定结果。

## 当前范围

- 记录每场世界杯比赛：赛程、球队、场地、赔率、模型观点、最终决策和赛果。
- 区分 `user` 和 `codex` 两个决策来源：谁做预测、谁负责额度、谁实际执行下单、是否真实资金都要记录清楚。
- 建设可视化 dashboard：资金曲线、ROI、概率校准、风险敞口、收盘线价值、单场比赛分析卡片。
- 优先使用公开/开放数据；付费数据或浏览器采集只在必要且允许时使用。

## 数据策略

参见 [docs/data-sources.md](docs/data-sources.md)。

初始方向：

- 用 FIFA 官方赛程做最终校验。
- 用 `openfootball/worldcup.json` 作为开放赛程基础数据。
- 评估 `rezarahiminia/worldcup2026` 作为 104 场赛程、场馆、球队、比分和积分榜补充源。
- 把 `machina-sports/sports-skills` 作为 Codex/agent 工作流工具，不作为 app 运行时依赖。
- 如果有 API key，用 API-Football 或类似服务补充赛程、积分、伤停、首发、技术统计。
- 赔率来源默认用你提供的 Betway 截图或文本，也可以评估 The Odds API，必要时再用浏览器辅助采集。

## 操作规则

参见 [docs/operating-playbook.md](docs/operating-playbook.md)。

## 在 Codex 里使用

本仓库内置 repo-local skills，别人 clone 后也可以在 Codex 里直接触发项目能力，不依赖原维护者的全局 Codex 配置。

入口文档见 [docs/codex-usage.md](docs/codex-usage.md)。

新用户推荐初始化：

```bash
pnpm install
pnpm run setup:local
```

如果需要本地安装 sports-skills CLI 辅助足球数据和赔率计算：

```bash
pnpm setup:agents
```

`pnpm run setup:local` 会复制 `.env.example`、迁移数据库、写入默认账本/风险配置、同步世界杯赛程，并校验 `.agents/skills` 是否完整。

不要执行裸的 `pnpm setup`；这是 pnpm 自己的全局配置命令，不是本项目初始化命令。

推荐触发方式：

```text
使用 wordcup-space，帮我初始化本地世界杯工作台。
```

```text
使用 wordcup-space，分析明天四场比赛，先预测比分，再给单关和串关计划。
```

```text
使用 wordcup-space，我发一张下注成功截图，你帮我 dry-run 录入。
```

可直接使用的能力：

- 比分预测和预测命中复盘：`.agents/skills/codex-match-predictor`
- 下注分析、单关、串关、风控和下注记录：`.agents/skills/codex-betting-operator`
- SABA/BW 盘口采集：`pnpm capture:saba-odds`
- 已成交注单录入：`pnpm record:placed-bet`
- 赛后结算和复盘：本地 API + Codex 操作流程

真实下注提交不自动化。Codex 可以分析、准备计划、解析截图和记录系统数据，但外部平台最后提交必须由本地用户确认。

系统端到端流程参见 [docs/system-workflow.md](docs/system-workflow.md)，包含赛程同步、盘口录入、决策、执行、成交、结算、账本和复盘闭环。

口述、截图和下注凭证交给 Codex 处理的格式参见 [docs/codex-capture-guide.md](docs/codex-capture-guide.md)。

聊天窗口是默认录入入口；页面表单只是备用。Codex 代操作已成交注单时，先用 `pnpm record:placed-bet` dry-run，得到你确认后才加 `--write` 写库。

外部 provider 与 Codex 工作流接入参见 [docs/provider-agent-integration.md](docs/provider-agent-integration.md)。

关键默认值：

- Codex 可配置独立额度；初始建议额度约 `1000`，以你实际分配为准。
- 单场普通下注上限：资金的 `10%`；高信心上限：`20%`。
- 串关上限：资金的 `5%`。
- 单日亏损上限：资金的 `40%`。
- 每次推荐都必须记录概率、赔率、期望值、下注金额、理由和赛后结果。

## 本地服务约定

开发服务和日常使用服务必须分开，避免 Codex 开发时影响你的使用。

| 场景 | 命令 | 端口 | 说明 |
|---|---|---:|---|
| 开发/验证 | `pnpm dev` | `3107` | Codex 开发、调试、页面验证使用。 |
| 构建检查 | `pnpm build` | 无 | 只生成 `.next` 构建产物；不会自动重启使用服务。 |
| 日常使用 | `pnpm start` | `3108` | 基于最近一次 build 的本机稳定服务。 |
| 一键更新使用服务 | `pnpm run run` | `3108` | 先 build，再启动 3108；只在你确认更新时使用。 |

约定：

- Codex 开发时可以运行 `pnpm dev`、`pnpm lint`、`pnpm test`、`pnpm build` 做验证。
- Codex 不应擅自启动、停止或重启 `3108` 使用服务。
- 只有你明确说“更新使用服务 / 重新部署 / build 后重启”，才执行 `pnpm run run` 或重启 `pnpm start` 对应的 3108 服务。
- `pnpm build` 通过不代表 3108 已更新；3108 只有重启后才会使用新的构建产物。

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
