# 数据源

最近检查日期：2026-06-12。

## 赛程和赛事数据

| 优先级 | 来源 | 用途 | 备注 |
|---|---|---|---|
| 1 | FIFA 官方赛程 | 校验比赛日期、场地、球队、赛果的最终事实源 | https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums |
| 2 | `openfootball/worldcup.json` | 开放赛程基础数据和历史世界杯数据；当前 `pnpm sync:worldcup2026` 使用此来源 | https://github.com/openfootball/worldcup.json |
| 3 | `rezarahiminia/worldcup2026` | 104 场比赛、48 队、12 组、16 场馆、比分和积分榜补充源；适合写成第二个 sync provider | https://github.com/rezarahiminia/worldcup2026 |
| 4 | WC26 MCP / Machina `world-cup` skill | 适合 AI agent 使用的赛程、球队、市场和赛前 brief；付费或 MCP 可用性不保证 | https://github.com/machina-sports/sports-skills |
| 5 | API-Football / API-SPORTS | 赛程、积分、首发、事件、球队/球员技术统计 | https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports |

## 赔率数据

| 优先级 | 来源 | 用途 | 备注 |
|---|---|---|---|
| 1 | 你提供的 Betway 盘口截图或文本 | 你实际看到的盘口，优先级最高 | 记录时间、博彩公司、市场、盘口线、赔率和截图/来源说明。 |
| 2 | ESPN odds API / DraftKings | DraftKings 全场胜平负参考赔率 | 当前 `pnpm sync:odds` 默认使用 ESPN 的公开 odds API 拉取 DraftKings。 |
| 3 | bet365 News / 可配置公开源 | bet365 全场胜平负参考赔率 | 公开 News 页只覆盖部分比赛；可用 `ODDS_SOURCE_FIXTURES_JSON` 增补来源。 |
| 4 | BW / 沙盟体育 / SABA / 页面文本采集 | 用户真实可下单平台的赛前盘口快照 | 优先使用 `pnpm sync:match-odds -- --date <本地日期> --scope common` 编排 SABA API 和页面文本兜底；`pnpm capture:saba-odds` 仅作为底层诊断，`pnpm capture:bw-odds` 保留为单场文本兜底。 |
| 5 | The Odds API / 其他商业 odds API | 多家博彩公司赔率标准化和横向比较 | 使用本地环境变量保存 key，不提交 secrets。 |
| 6 | 手工研究 | 补充上下文和交叉校验 | 来源写入 `source_note`。 |

Betway 盘口名称和系统 `market` key 的映射见 [Betway 常用盘口类型字典](/Users/zhuguidong/WorkSpace/PrivateSpace/wordcup-space/docs/betway-market-types.md:1)。浏览器采集时要区分常规比赛详情、`赔率增值`、`赛事串关` 和 `先开球` 等副市场。

当前内置赔率同步目标平台限定为 Betway、bet365、DraftKings。命令：

```bash
pnpm sync:odds
```

同步写入 `odds_snapshots`。如果同一场、同一平台、同一市场的最新 1X2 赔率没有变化，命令会返回 `unchanged` 并跳过写入，避免重复快照。

BW / SABA 赛前盘口采集：

```bash
pnpm sync:match-odds -- --date 2026-06-15 --scope common
pnpm sync:match-odds -- --date 2026-06-15 --scope common --write
```

`common` 只写入稳定识别的常用盘口；`all` 会把未知盘口用 `saba:<betTypeId>` 归档。编排命令会标记每场盘口覆盖是否完整；如果 SABA visitor API 只返回单一盘口，不得把结果用于完整盘口分析，必须补页面文本或其它可比来源。接口 token 只在内存中使用，不能打印、不能写入 docs 或数据库。

登录态页面文本兜底：

```bash
pnpm capture:chrome-odds-text -- --match-id 10
pnpm sync:match-odds -- --date 2026-06-15 --scope common --fallback-text-dir tmp/bw-odds/2026-06-15
```

该命令只复制 Chrome 当前比赛详情页文本到 `tmp/bw-odds/`，不点击下注控件；写库仍由 `sync:match-odds --fallback-text-dir ... --write` 负责。

如果跑 `--scope all`，建议加节流：

```bash
pnpm sync:match-odds -- --date 2026-06-15 --scope all --request-delay-ms 750
```

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
