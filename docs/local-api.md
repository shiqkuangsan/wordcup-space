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

```json
{
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

`POST /api/bet-slips`

默认按真实资金记录；只有明确传 `isRealMoney: false` 才是模拟记录。

```json
{
  "betIntentId": "intent_xxx",
  "platformAccountId": "bet365-main",
  "executionMethod": "user_manual",
  "stake": 10,
  "finalOdds": 1.9,
  "isRealMoney": true,
  "confirmationRef": "平台注单号或截图备注"
}
```

## 结算注单

`POST /api/settlements`

```json
{
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
