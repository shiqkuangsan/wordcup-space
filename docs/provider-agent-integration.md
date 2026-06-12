# Provider and Agent Integration

## 目标

当前系统本体不追求内置强 AI。`wordcup-space` 应继续负责可靠的本地记录和资金闭环，Codex 在项目目录中通过外部工具补充研究、赔率数学和数据校验。

这次关注两个外部仓库：

| 仓库 | 本项目定位 | 接入边界 |
|---|---|---|
| `rezarahiminia/worldcup2026` | 世界杯 2026 数据 provider | 赛程、球队、场馆、比分、积分榜；不输出下注建议。 |
| `machina-sports/sports-skills` | Codex/agent 工具箱 | 足球数据、赔率数学、市场比较、World Cup MCP；不进入 app runtime，不自动下单。 |

## 当前系统流程位置

现有流程已经分清四件事：

| 阶段 | 当前入口 | 外部仓库可补强的部分 |
|---|---|---|
| 赛程同步 | `pnpm sync:worldcup2026`、`POST /api/matches/sync` | 用 `worldcup2026` 补 104 场、场馆、比分和积分榜。 |
| 盘口记录 | `/matches/[id]`、`odds_snapshots` | 仍以用户截图/文本为准；`sports-skills@betting` 只做换算和去水。 |
| Codex 分析 | `/api/intents`、`bet_intents` | 用 `sports-skills` 收集上下文和做赔率数学，输出结构化 rationale。 |
| 成交和结算 | `/api/bet-slips`、`/api/settlements` | 不接外部下注/交易执行。真实资金变化只由本地成交和结算动作触发。 |

## 不建议 vendor 或 submodule

不要把两个仓库 clone 到当前 repo 内作为源码依赖。

原因：

- `worldcup2026` 是独立 Express/MongoDB 服务，本项目只需要它的数据形状和线上/自托管 API。
- `sports-skills` 是 agent skill / Python CLI，不应该成为 Next.js app 的运行时依赖。
- 外部仓库变更频繁，vendor 进来会增加安全、许可证、依赖和更新成本。
- 本项目的关键资产是审计链路和资金账本，外部工具只应该提供可替换的输入。

需要研究源码时，clone 到临时目录或仓库外 research 目录，例如：

```bash
mkdir -p /tmp/wordcup-space-research
git clone --depth 1 https://github.com/rezarahiminia/worldcup2026.git /tmp/wordcup-space-research/worldcup2026
git clone --depth 1 https://github.com/machina-sports/sports-skills.git /tmp/wordcup-space-research/sports-skills
```

## `worldcup2026` 接入策略

第一版只做 read-only provider，不改账本和下注流程。

推荐 provider 设计：

```text
src/server/providers/worldcup2026-api.ts
  fetchGames()
  fetchTeams()
  fetchGroups()
  fetchStadiums()
  normalizeWorldCup2026Games()

src/server/actions/worldcup2026-api-sync.ts
  syncWorldCup2026ApiMatches()
```

数据合并规则：

| 字段 | 映射 |
|---|---|
| `id` | `externalId = worldcup2026-game-${id}` |
| `home_team_name_en` / `away_team_name_en` | `homeTeam` / `awayTeam`，再经过本地 `formatTeamName` |
| `date` 或 `local_date` | `kickoffAt`，必须显式处理时区；无法确认时标记 `data_quality=low` 或不覆盖现有 kickoff |
| `group` | `groupName` |
| `type` | `stage`，映射为 `group_stage`、`round_of_32`、`round_of_16` 等本地枚举 |
| `stadium_id` | 第一版可映射到 `venue`；后续再加 stadium 表 |
| `finished` / `time_elapsed` / score | 可用于后续 match result sync；第一版不自动结算注单 |

冲突处理：

- FIFA 官方事实优先。
- 已有 `openfootball` 记录不直接删除。
- 如果同一场比赛来源不同但球队/时间/场馆冲突，先写入 source note 或在 sync result 中报告，不静默覆盖。
- 自动比分同步不能自动结算真实注单；结算仍需要用户确认平台结果。

## `sports-skills` 接入策略

安装在 agent runtime，不放进 app dependency：

```bash
npx skills add machina-sports/sports-skills@football-data --yes
npx skills add machina-sports/sports-skills@betting --yes
npx skills add machina-sports/sports-skills@markets --yes
npx skills add machina-sports/sports-skills@world-cup --yes
```

当前本地已安装的最小集合：

```text
.agents/skills/football-data
.agents/skills/betting
.agents/skills/markets
.agents/sports-skills-venv/bin/sports-skills
```

`.agents/` 是本地 agent runtime 目录，已被 `.gitignore` 忽略，不作为项目源码提交。

Codex 使用顺序：

1. 先读本地数据库/API：比赛、赔率、资金、风险参数。
2. 用 `worldcup2026` provider 校验赛程、场馆、比分和积分榜。
3. 如可用，用 `sports-skills@football-data` 查球队/赛程/上下文。
4. 用 `sports-skills@betting` 对本地赔率做隐含概率、去水、EV、Kelly 或串关计算。
5. 如可用，用 `sports-skills@markets` 或 `world-cup` skill 查询预测市场，只作为市场信号。
6. 输出结构化分析，再通过 `POST /api/intents` 的 `dryRun` 预览。

Codex 分析输出必须包含：

```json
{
  "sources": [],
  "dataQuality": "low|medium|high",
  "modelProbability": 0.0,
  "fairOdds": 0.0,
  "marketImpliedProbability": 0.0,
  "expectedValue": 0.0,
  "riskTier": "low|normal|high",
  "recommendation": "bet|pass|wait",
  "rationale": ""
}
```

## 定期更新策略

不需要后台常驻任务。先采用人工触发 + 页面访问 stale check。

| 对象 | 更新方式 | 频率 |
|---|---|---|
| OpenFootball 赛程 | 现有 `pnpm sync:worldcup2026` | 页面 stale check 或手动 |
| `worldcup2026` API | 新增 `pnpm sync:worldcup2026:api` | 赛前每 12 小时；比赛日每 1-2 小时手动触发 |
| `sports-skills` skills | `npx skills add machina-sports/sports-skills --yes` 或单 skill upgrade | 每周一次；重大分析前手动 |
| `sports-skills` CLI | `.agents/sports-skills-venv/bin/python -m pip install --upgrade sports-skills` | 每周一次；重大分析前手动 |
| 外部仓库源码 clone | 只在研究/调试时临时 clone | 不定期，不进 git |

## 实施顺序

1. 文档落地：统一数据源、AI 使用规则、provider 边界。
2. 新增 `worldcup2026` provider 单元测试，先用本地 fixture 锁定映射。
3. 实现 `worldcup2026` API sync action 和 CLI script。
4. 更新 `/api/matches/sync` 或现有 sync 结果展示，让冲突可见。
5. 安装并验证 `sports-skills` 在 Codex runtime 可用。
6. 增加 Codex 分析契约文档，把输出稳定映射到 `bet_intents`。
7. 赛前再考虑比分/积分榜同步；真实注单结算仍人工确认。

## 验证

- `pnpm test` 覆盖 provider mapping 和冲突处理。
- `pnpm sync:worldcup2026:api` 在无 token 场景可读 games；不可用时返回清晰错误。
- `POST /api/intents` 仍先 dry-run，不因外部工具自动写真实资金记录。
- 文档中所有风险上限和真实资金默认语义保持一致。
