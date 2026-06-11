# 数据源

最近检查日期：2026-06-10。

## 赛程和赛事数据

| 优先级 | 来源 | 用途 | 备注 |
|---|---|---|---|
| 1 | FIFA 官方赛程 | 校验比赛日期、场地、球队、赛果的最终事实源 | https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums |
| 2 | `openfootball/worldcup.json` | 开放赛程基础数据和历史世界杯数据；当前 `npm run sync:worldcup2026` 使用此来源 | https://github.com/openfootball/worldcup.json |
| 3 | `rezarahiminia/worldcup2026` | 104 场比赛、48 队、12 组、16 场馆、比分和积分榜补充源；适合写成第二个 sync provider | https://github.com/rezarahiminia/worldcup2026 |
| 4 | WC26 MCP / Machina `world-cup` skill | 适合 AI agent 使用的赛程、球队、市场和赛前 brief；付费或 MCP 可用性不保证 | https://github.com/machina-sports/sports-skills |
| 5 | API-Football / API-SPORTS | 赛程、积分、首发、事件、球队/球员技术统计 | https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports |

## 赔率数据

| 优先级 | 来源 | 用途 | 备注 |
|---|---|---|---|
| 1 | 你提供的 Betway 盘口截图或文本 | 你实际看到的盘口，优先级最高 | 记录时间、博彩公司、市场、盘口线、赔率和截图/来源说明。 |
| 2 | The Odds API | 多家博彩公司赔率标准化和横向比较 | https://theoddsapi.com/ |
| 3 | 浏览器辅助采集 | 当赔率只在登录浏览器里可见时使用 | 只采集你有权访问的内容；只保存标准化数值，不保存账号凭据。 |
| 4 | 手工研究 | 补充上下文和交叉校验 | 来源写入 `source_note`。 |

## Codex / Agent 工具

| 工具 | 用途 | 接入方式 | 备注 |
|---|---|---|---|
| `machina-sports/sports-skills@football-data` | 足球赛程、积分、球队、比赛统计、部分 xG / 伤停信息 | 安装到 Codex/agent runtime；不加入 app `package.json` | World Cup 覆盖可用，但部分高级数据只覆盖指定联赛。 |
| `machina-sports/sports-skills@betting` | 赔率转换、去水、edge、Kelly、套利、串关分析 | 安装到 Codex/agent runtime；纯计算，不联网取赔率 | 适合复核 `odds_snapshots` 和 `bet_intents` 的概率/EV。 |
| `machina-sports/sports-skills@markets` | Kalshi / Polymarket / ESPN 市场比较和价格归一化 | 可选安装；仅作为市场信号参考 | 市场价格不能直接等同真实胜率。 |
| `machina-sports/sports-skills@world-cup` | 世界杯官方事实、预测市场、赛前 brief 的 read-only MCP 层 | 可选安装；需要 Machina CLI/MCP 和可能的付费额度 | 不做交易或下注执行。 |

## 球队实力和上下文

可用补充维度：

- FIFA 排名和 Elo 类球队评分。
- 近期正式比赛状态，以及对手强度。
- 大名单、伤停、停赛、轮换和预计首发。
- 休息天数、旅行距离、场地气候、海拔、当地开球时间。
- 战术对位、比赛动机和小组/淘汰赛背景。
- 赔率变化、收盘线价值和市场方向。

## 来源规则

- 官方来源优先于第三方来源。
- 多来源冲突时，先保留本地记录并标记来源；人工确认后再覆盖关键事实。
- 赔率快照必须带时间戳。
- 如果预测依赖过期或缺失数据，必须标记 `data_quality`。
- Codex/agent 工具输出必须写明来源、时间和可用性限制；没有来源的判断只能标记为假设。
- 浏览器采集的数据要尽量可复核。
- 不提交 secrets、cookies、包含账号信息的截图，或未经确认可提交的付费 provider 原始数据。
