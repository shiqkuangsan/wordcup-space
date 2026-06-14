# Codex 使用指南

本文面向 clone 本仓库的其他用户，说明如何在 Codex 里直接使用预测、分析、下注计划、串关、盘口采集、注单记录和复盘能力。

## 能力边界

这个项目提供的是本地工作台和 Codex 操作规程，不是投注平台，也不是自动代下单工具。

| 能力 | 是否可直接使用 | 依赖 |
|---|---|---|
| 赛程同步和比赛库 | 可以 | 本地数据库和公开赛程 provider |
| 盘口快照采集 | 可以 | SABA/BW 可访问；接口可能随平台变化 |
| 比分预测记录 | 可以 | 本地 API；AI 研究由 Codex 执行 |
| Codex 分析 | 可以 | Codex 会话、项目 skills、可用网络/浏览器 |
| 单关计划 | 可以 | 本地盘口、球队信息、资金规则 |
| 串关计划 | 可以 | 同上，且需要额外风控 |
| 已成交注单记录 | 可以 | 用户提供成功截图、注单号或明确口述 |
| 真实下注提交 | 不自动化 | 用户自己的平台账户和手动确认 |
| 赛后结算/复盘 | 可以 | 赛果来源和本地注单记录 |

## 初次安装

```bash
pnpm install
pnpm run setup:local
pnpm build
pnpm start
```

`pnpm run setup:local` 会执行：

1. 如果没有 `.env`，从 `.env.example` 创建。
2. 运行 `pnpm db:migrate`。
3. 运行 `pnpm db:seed`，写入默认 User/Codex 账本、平台账户、风险规则和基础设置。
4. 运行 `pnpm sync:worldcup2026`，同步世界杯赛程。
5. 运行 `pnpm verify:skills`，确认 repo-local Codex skills 完整。

可选参数：

| 参数 | 说明 |
|---|---|
| `--dry-run` | 只打印将执行的动作，不写文件、不跑迁移。 |
| `--skip-sync` | 跳过赛程同步。 |
| `--force` | 保留给未来破坏性重置模式；当前不会删除或覆盖已有数据库。 |

不要执行裸的 `pnpm setup`。那是 pnpm 自己的全局配置命令，不是本项目初始化命令。

默认端口：

| 命令 | 用途 | 端口 |
|---|---|---:|
| `pnpm dev` | 开发/验证 | `3107` |
| `pnpm start` | 本地使用服务 | `3108` |
| `pnpm run run` | build 后启动使用服务 | `3108` |

`.env` 里的 AI key 和第三方数据 key 必须使用自己的，不要复用别人的密钥。

`pnpm verify:skills` 会检查仓库内置 Codex skills 是否存在、hash 是否匹配、引用的 `references/` 文件是否齐全。公开分发或更新 skills 后应先跑这个命令。

如果需要安装 sports-skills CLI runtime：

```bash
pnpm setup:agents
```

这个命令会创建本地虚拟环境 `.agents/sports-skills-venv/` 并安装 `sports-skills`。该目录是本机生成物，不进 Git。

## Codex 如何发现能力

仓库内置了项目 skills：

| Skill | 用途 |
|---|---|
| `.agents/skills/wordcup-space` | 项目总入口，适合新会话或新用户 |
| `.agents/skills/codex-match-predictor` | 比分预测、预测更新、预测命中复盘 |
| `.agents/skills/codex-betting-operator` | 下注分析、单关/串关、风控、截图录单、结算复盘 |
| `.agents/skills/football-data` | 足球公开数据辅助查询 |
| `.agents/skills/betting` | 赔率转换、去水、EV、Kelly、串关计算 |
| `.agents/skills/markets` | 预测市场/盘口比较，按可用性使用 |

在 Codex 新会话中，先进入仓库目录，再用明确触发词：

```text
使用 wordcup-space，帮我初始化本地世界杯工作台。
```

```text
使用 wordcup-space，分析明天四场比赛，先预测比分，再给单关和串关计划。
```

```text
使用 codex-match-predictor，预测本周未开赛比赛的比分。
```

```text
使用 codex-betting-operator，基于今天盘口给 Codex 的真实资金下注计划。
```

## 初始化个人数据

别人使用本项目时，必须把下面几类数据改成自己的：

| 数据 | 说明 |
|---|---|
| `portfolios` | 用户自己的 User/Codex 账本和初始额度 |
| `platform_accounts` | 自己的平台账户，例如 Betway、BW、其他 sportsbook |
| `risk_profiles` | 自己能接受的单关、串关、日额度和止损规则 |
| `.env` | 自己的 AI key、数据源 key、本地数据库路径 |
| 浏览器登录态 | 自己的平台登录，不共享、不提交 |

默认记录真实资金。只有明确传 `isRealMoney=false` 才是模拟记录。

## 盘口采集

推荐先用 SABA/BW API 采集常用盘口：

```bash
pnpm capture:saba-odds -- --date 2026-06-15 --scope common
pnpm capture:saba-odds -- --date 2026-06-15 --scope common --write
```

说明：

- 不带 `--write` 是 dry-run，只检查比赛匹配和解析结果。
- 带 `--write` 才写入 `odds_snapshots`。
- `--scope common` 用于日常决策。
- `--scope all` 用于全量归档，行数更大，建议加 `--request-delay-ms 750`。

文本兜底：

```bash
pbpaste | pnpm capture:bw-odds -- --match-id 10 --stdin --dry-run
pbpaste | pnpm capture:bw-odds -- --match-id 10 --stdin --write
```

盘口采集只读 bookmaker 页面，不创建下注决策，也不创建注单。

## 预测流程

Codex 预测必须发生在开赛前。

典型请求：

```text
使用 wordcup-space，预测本周还没开赛的比赛比分，写入系统。
```

Codex 应执行：

1. 读取本地 `matches`。
2. 过滤未开赛且在当前周内的比赛。
3. 读取已有预测，避免重复创建。
4. 用盘口、球队状态、伤停、战术、赛程和主场因素形成预测。
5. 信息不足时可以暂缓，不强行预测。
6. 写入 `/api/predictions` 或直接使用本地脚本/API。

预测只统计比分命中，不等于下注建议。

## 分析和下注计划

典型请求：

```text
使用 wordcup-space，分析明天四场比赛，给 Codex 的单关和串关计划。
```

Codex 应输出：

- 当前 Codex 余额和当日 25% 本金上限；
- 每场比分预测；
- 单关候选、放弃原因和观察条件；
- 普通串关候选；
- 可选比分串，小额高波动；
- 每张票的金额、当前赔率、最低执行赔率；
- 反方证据和放弃条件。

Codex 只在计划通过后创建 `bet_intent`。真实下注成功前不能创建 `bet_slip`。

## 记录已成交注单

用户下单成功后，把截图或口述给 Codex。

Codex 默认先生成 payload 并 dry-run：

```bash
pnpm record:placed-bet -- --input payload.json
```

确认无误后：

```bash
pnpm record:placed-bet -- --input payload.json --write
```

最少需要这些字段：

- 比赛或比赛文本；
- 市场；
- 选择；
- 投注金额；
- 最终赔率；
- 赔率格式；
- 平台账户；
- 注单号或成功截图说明；
- `portfolioId`、`decisionBy`、`placedBy`、`isRealMoney`。

## 结算和复盘

赛后请求：

```text
使用 wordcup-space，这几场出结果了，联网查赛果，帮我结算并复盘。
```

Codex 应执行：

1. 查证赛果来源。
2. 更新比赛结果。
3. 结算所有相关 open slip。
4. 更新 User/Codex 账本。
5. 更新预测命中状态。
6. 复盘预测和下注，区分正常方差、盘口选择错误、数据缺口、执行错误和风控问题。

## 公开分发注意事项

不要提交：

- `.env`
- 平台 cookies/session
- 真实 API key
- 用户私密截图
- 真实平台账号敏感信息
- 本地 `local.db`，除非是明确脱敏示例库

如果要做公开模板仓库，建议新增一个脱敏 demo seed，而不是复用个人实战数据库。
