# 本地 API 速查

默认使用地址：`http://localhost:3108`

开发调试地址：`http://localhost:3107`

端口约定：

- `pnpm dev` 启动开发服务，固定使用 `3107`。
- `pnpm start` 启动本机使用服务，固定使用 `3108`。
- `pnpm build` 只生成构建产物，不会自动重启 `3108`。
- `pnpm run run` 会先构建再启动 `3108`，只在确认更新使用服务时执行。
- Codex 开发时可以验证 `3107`；除非用户明确要求更新使用服务，否则不要重启 `3108`。

## 同步 2026 世界杯小组赛

```bash
pnpm sync:worldcup2026
```

当前脚本使用 OpenFootball 的公开 JSON 数据源，只导入小组赛 72 场；后续如果需要 FIFA 官方页面二次校验，可由 Codex 浏览器读取后再走 `POST /api/matches/sync` 覆盖更新。

## 同步 worldcup2026 API

```bash
pnpm sync:worldcup2026:api
```

这个脚本读取 `https://worldcup26.ir/get/games` 和 `/get/stadiums`，把可标准化的比赛写入 `matches`。它只同步比赛事实和比分状态元数据，不创建赔率、决策、注单、资金流水或结算。

可选环境变量：

| 变量 | 说明 |
|---|---|
| `WORLDCUP2026_API_BASE_URL` | 覆盖默认 API base URL，默认 `https://worldcup26.ir`。 |
| `WORLDCUP2026_API_TOKEN` | 如果 provider 后续要求 JWT，可作为 Bearer token 发送；当前公开读取不强制。 |

## 同步赛程

`POST /api/matches/sync`

```json
{
  "sourceName": "browser-normalized",
  "sourceUrl": "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures",
  "matches": [
    {
      "externalId": "fifa-2026-001",
      "matchNumber": 1,
      "stage": "小组赛",
      "groupName": "A",
      "homeTeam": "墨西哥",
      "awayTeam": "南非",
      "kickoffAt": "2026-06-11T20:00:00Z",
      "venue": "Estadio Azteca",
      "status": "未开赛"
    }
  ]
}
```

## 创建决策

`POST /api/intents`

Codex 分析输出契约参见 [docs/codex-analysis-contract.md](/Users/zhuguidong/WorkSpace/PrivateSpace/wordcup-space/docs/codex-analysis-contract.md:1)。

截图/口述解析后默认先传 `dryRun: true`。预览不会写库，确认无误后再去掉 `dryRun` 正式创建。

```json
{
  "dryRun": true,
  "portfolioId": "codex",
  "decisionBy": "codex",
  "mode": "single",
  "market": "full_time:moneyline",
  "stake": 10,
  "intendedTotalOdds": 1.9,
  "riskTier": "normal",
  "confidence": "medium",
  "rationale": "截图/盘口分析后的 Codex 决策。",
  "legs": [
    {
      "matchId": "match_xxx",
      "market": "1X2",
      "selection": "阿根廷胜",
      "intendedOdds": 1.9
    }
  ]
}
```

## 记录已成交注单

### 截图/口述直录

`POST /api/placed-bets`

适合你已经在手机或平台下完单，随后把截图/口述发给 Codex 的场景。这个接口会在确认写入时一次性生成：

- `bet_intent`
- `bet_intent_leg`
- `execution_attempt`
- `bet_slip`
- `bet_slip_leg`
- `portfolio_ledger_entries`

默认同样先传 `dryRun: true`。确认无误后去掉 `dryRun`，系统才扣款并生成真实注单。

聊天窗口里由 Codex 代操作时，优先使用本地脚本包装这个接口的同一套逻辑：

```bash
pnpm record:placed-bet -- --input payload.json
pnpm record:placed-bet -- --input payload.json --write
```

默认不加 `--write` 时只预览，不写库。只有你确认后才加 `--write`。

单关可以直接传顶层比赛和盘口字段：

```json
{
  "dryRun": true,
  "portfolioId": "user",
  "decisionBy": "user",
  "mode": "single",
  "matchId": "match-0eded355-e740-4a18-ab33-430100612034",
  "market": "full_time:highest_scoring_half",
  "selection": "下半场",
  "stake": 50,
  "finalOdds": 2.01,
  "oddsFormat": "decimal",
  "platformAccountId": "betway-main",
  "executionMethod": "user_manual",
  "confirmationRef": "example-ticket-001",
  "sourceText": "示例截图：RMB 50 单注，下半场，进球最多的半场，墨西哥 vs 南非，赔率 2.01，赢取 100.50。"
}
```

串关传 `mode: "parlay"` 和 `legs[]`。父级 `finalOdds` 可以省略，系统会用每条 leg 的欧盘赔率相乘；如果平台成功页显示了总赔率，也可以把总赔率放在父级 `finalOdds`。写入后 `bet_slips.final_odds` 存整张串关总赔率，`bet_slip_legs.final_odds` 存每条 leg 自己的赔率。

```json
{
  "dryRun": true,
  "portfolioId": "user",
  "decisionBy": "user",
  "mode": "parlay",
  "market": "parlay",
  "stake": 50,
  "platformAccountId": "betway-main",
  "executionMethod": "user_manual",
  "confirmationRef": "2606121327375036",
  "sourceText": "Betway 投注成功：2串1，上半场大小小0.5，加拿大 vs 波黑 @2.53，美国 vs 巴拉圭 @2.44，总投注 50，可赢 258.66。",
  "legs": [
    {
      "matchText": "加拿大 vs 波黑",
      "market": "half_time:total",
      "selection": "under",
      "line": "0.5",
      "finalOdds": 2.53
    },
    {
      "matchText": "美国 vs 巴拉圭",
      "market": "half_time:total",
      "selection": "under",
      "line": "0.5",
      "finalOdds": 2.44
    }
  ]
}
```

注意：部分平台的“可赢金额”只显示盈利，不含本金。系统的 `potentialReturnCents` 记录返还总额，等于 `stake * finalOdds`，不是只记录盈利。

如果不是世界杯赛程库里的比赛，可以不传 `matchId`，改传 `matchText`：

```json
{
  "dryRun": true,
  "portfolioId": "user",
  "decisionBy": "user",
  "matchText": "英超 A队 vs B队",
  "market": "full_time:moneyline",
  "selection": "主胜",
  "stake": 50,
  "finalOdds": 1.01,
  "oddsFormat": "hong_kong",
  "platformAccountId": "betway-main",
  "confirmationRef": "ticket_xxx"
}
```

赔率格式：

| oddsFormat | 含义 | 示例 | 系统内部计算 |
|---|---|---:|---:|
| `decimal` | 欧盘，含本金 | 2.01 | 2.01 |
| `hong_kong` | 港盘，不含本金 | 1.01 | 2.01 |

截图识别出来的信息不完整时，先不要写入；至少需要比赛或比赛文本、玩法、选择、金额、赔率、赔率格式、平台账户和注单号。

### 已有决策成交

`POST /api/bet-slips`

默认按真实资金记录；只有明确传 `isRealMoney: false` 才是模拟记录。
支持 `dryRun: true` 预览执行赔率变化、余额扣减和潜在返还，不生成 attempt、slip 或资金流水。
推荐流程是：截图/口述解析 → `dryRun` 预览 → 核对金额、赔率、余额变化、警告 → 去掉 `dryRun` 写入。

```json
{
  "dryRun": true,
  "betIntentId": "intent_xxx",
  "platformAccountId": "betway-main",
  "executionMethod": "user_manual",
  "stake": 10,
  "finalOdds": 1.9,
  "isRealMoney": true,
  "confirmationRef": "平台注单号或截图备注"
}
```

字段要点：

| 字段 | 说明 |
|---|---|
| `betIntentId` | 必须来自一条未成交的决策 |
| `stake` / `stakeCents` | 二选一；UI 用元，API 可直接用分 |
| `finalOdds` | 平台最终成交赔率 |
| `observedOdds` | 下单时观察到的赔率；不传则按 `finalOdds` |
| `executionMethod` | `user_manual`、`chrome`、`computer_use`、`browser_capture` |
| `confirmationRef` | 平台注单号、截图编号或可追溯备注 |

## 结算注单

`POST /api/settlements`

支持 `dryRun: true` 预览返还金额、盈亏和结算后余额，不写 settlement 或资金流水。
推荐流程是：你同步赛果/平台结算结果 → `dryRun` 预览 → 核对返还、盈亏、余额变化 → 去掉 `dryRun` 写入。

```json
{
  "dryRun": true,
  "betSlipId": "slip_xxx",
  "result": "won",
  "sourceNote": "用户同步赛果：阿根廷胜。"
}
```

结算结果：

| result | 含义 |
|---|---|
| `won` | 赢：全赢，返还本金+盈利 |
| `lost` | 输：全输，不再返还 |
| `void` | 走水：退回本金 |
| `half_won` | 半赢：半注赢、半注走水 |
| `half_lost` | 半输：半注输、半注走水 |
| `cashout` | 提前兑现：必须传 `cashoutAmountCents` 或 UI 填兑现到账金额 |
| `cancelled` | 取消/无效：退回本金 |

## 读取数据

- `GET /api/matches`
- `GET /api/system/summary`
