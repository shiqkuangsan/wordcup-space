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

## 自主下注证据门槛

Codex 自主下注前必须先通过证据门槛。未通过时只能输出 `wait` 或 `pass`，不能创建可执行下注决策。

Codex 自主下注必须先按“本周组合”分析，而不是逐场孤立分析。每次需要 Codex 决策时，先形成本周候选池和组合计划，再决定哪些比赛做单场、哪些比赛做串关腿、哪些放弃，以及总下注额和每日风险敞口。

User 和 Codex 是完全隔离的决策主体。分析 Codex 自主下注时，不得因为 User 已经下注同一场、同一盘口、同一方向或同一金额而自动跳过。User 注单只能作为背景信息或对照样本，不计入 Codex 风险敞口。

必查项：

| 项 | 要求 |
|---|---|
| 当前盘口 | 必须来自 Betway 当前页、截图或已记录 odds snapshot，并确认赔率格式。 |
| 赔率格式 | 必须区分欧盘、港盘、马来盘；不确定时不得写入可执行赔率。 |
| 市场对照 | 至少对照一个独立盘口/市场来源，或明确说明没有可靠对照并降级为 `wait`。 |
| 近期状态 | 必须查看双方近期战绩或状态指标。 |
| 历史交锋 | 必须查看 head-to-head，并说明样本是否太老/太少。 |
| 阵容伤停 | 必须查看伤停、停赛、预计首发；未公布时明确标注不确定。 |
| 反方证据 | 必须写出不支持下注的主要证据。 |
| 执行条件 | 必须写下注金额、最低可接受赔率、放弃条件。 |

如果缺少当前盘口、近期状态、阵容伤停或市场对照中的任一项，默认 `recommendation=wait`。观察倾向不能升级为 `bet_intent`。

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
  "minimumExecutableOdds": 1.9,
  "opposingEvidence": [
    "阵容未公布",
    "历史交锋样本过老"
  ],
  "abandonIf": "临场折合欧盘低于 1.90，或首发显示主力前锋缺阵。",
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
