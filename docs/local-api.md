# 本地 API 速查

默认地址：`http://localhost:3107`

## 同步 2026 世界杯小组赛

```bash
npm run sync:worldcup2026
```

当前脚本使用 OpenFootball 的公开 JSON 数据源，只导入小组赛 72 场；后续如果需要 FIFA 官方页面二次校验，可由 Codex 浏览器读取后再走 `POST /api/matches/sync` 覆盖更新。

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
  "platformAccountId": "bet365-main",
  "executionMethod": "user_manual",
  "confirmationRef": "534480127048810501",
  "sourceText": "手机截图：RMB 50 单注，下半场，进球最多的半场，墨西哥 vs 南非，赔率 2.01，赢取 100.50。"
}
```

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
  "platformAccountId": "bet365-main",
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
  "platformAccountId": "bet365-main",
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
