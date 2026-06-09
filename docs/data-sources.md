# 数据源

最近检查日期：2026-06-09。

## 赛程和赛事数据

| 优先级 | 来源 | 用途 | 备注 |
|---|---|---|---|
| 1 | FIFA 官方赛程 | 校验比赛日期、场地、球队、赛果的最终事实源 | https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums |
| 2 | `openfootball/worldcup.json` | 开放赛程基础数据和历史世界杯数据 | https://github.com/openfootball/worldcup.json |
| 3 | WC26 MCP | 适合 AI agent 使用的球队、场馆、赛程、对阵和新闻上下文 | https://wc26.ai/ |
| 4 | API-Football / API-SPORTS | 赛程、积分、首发、事件、球队/球员技术统计 | https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports |

## 赔率数据

| 优先级 | 来源 | 用途 | 备注 |
|---|---|---|---|
| 1 | 你提供的 Bet365 / Betway 盘口截图或文本 | 你实际看到的盘口，优先级最高 | 记录时间、博彩公司、市场、盘口线、赔率和截图/来源说明。 |
| 2 | The Odds API | 多家博彩公司赔率标准化和横向比较 | https://theoddsapi.com/ |
| 3 | 浏览器辅助采集 | 当赔率只在登录浏览器里可见时使用 | 只采集你有权访问的内容；只保存标准化数值，不保存账号凭据。 |
| 4 | 手工研究 | 补充上下文和交叉校验 | 来源写入 `source_note`。 |

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
- 赔率快照必须带时间戳。
- 如果预测依赖过期或缺失数据，必须标记 `data_quality`。
- 浏览器采集的数据要尽量可复核。
- 不提交 secrets、cookies、包含账号信息的截图，或未经确认可提交的付费 provider 原始数据。
