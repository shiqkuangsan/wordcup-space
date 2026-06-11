# Codex Analysis Contract

## 目标

Codex 可以使用本地数据、公开网页和 agent skills 辅助分析世界杯比赛，但分析本身不直接改变真实资金。任何下注动作都必须通过本地 API 的 `dryRun` 预览和用户确认。

## 输入顺序

分析一场比赛时按这个顺序取数：

1. 本地 `matches`：比赛、开球时间、场馆、阶段和来源。
2. 本地 `odds_snapshots`：你实际看到的盘口和赔率。
3. 本地 `portfolios` / `risk_profiles`：可用额度和风控上限。
4. `worldcup2026` provider：赛程、场馆、比分状态和积分榜补充。
5. `sports-skills@football-data`：球队、赛程、近期状态和公开比赛上下文。
6. `sports-skills@betting`：赔率转换、去水、EV、Kelly、串关计算。
7. `sports-skills@markets` 或 `world-cup` skill：预测市场和市场变化信号；只作为参考。

如果外部工具不可用，继续使用本地数据和手工/网页来源，并把 `dataQuality` 降级。

## 输出 JSON

Codex 在创建 `bet_intent` 前必须先形成这个结构：

```json
{
  "sources": [
    {
      "name": "local odds snapshot",
      "url": null,
      "capturedAt": "2026-06-10T12:00:00.000Z",
      "note": "Betway screenshot provided by user"
    }
  ],
  "dataQuality": "low",
  "market": "full_time:moneyline",
  "selection": "墨西哥胜",
  "modelProbability": 0.54,
  "fairOdds": 1.85,
  "marketImpliedProbability": 0.51,
  "expectedValue": 0.03,
  "riskTier": "normal",
  "confidence": "medium",
  "recommendation": "bet",
  "stake": 10,
  "rationale": "简短说明概率、盘口、风险和主要不确定性。"
}
```

枚举约定：

| 字段 | 允许值 |
|---|---|
| `dataQuality` | `low`、`medium`、`high` |
| `recommendation` | `bet`、`pass`、`wait` |
| `riskTier` | `low`、`normal`、`high` |
| `confidence` | `low`、`medium`、`high` |

## 写入规则

分析完成后，先调用：

```http
POST /api/intents
```

并传：

```json
{
  "dryRun": true
}
```

只有用户确认后，才去掉 `dryRun` 正式创建。Codex 不得因为外部工具给出正 EV 就直接创建真实下注或结算。

## 解释规则

- 所有数据型判断必须有来源；没有来源只能写成假设。
- 预测市场价格不能直接等同真实胜率。
- `sports-skills@world-cup` 是可选 premium/read-only 能力；不可用时不阻塞本地分析。
- 自动比分同步不能自动结算注单；平台结算仍需要用户确认。
- 输出要说明主要反方证据，例如伤停不确定、阵容未公布、盘口移动过快或数据源过期。
