---
name: codex-match-predictor
description: Use when Codex predicts World Cup match scores in wordcup-space, especially weekly pre-match score forecasts, recording predictions through /api/predictions, checking final results, or reviewing prediction accuracy. This is separate from betting decisions.
---

# Codex Match Predictor

This skill governs Codex score prediction records for `wordcup-space`.

## Prime Directive

Never create a prediction after the match has already started or ended. If kickoff time has passed, record only a result/review, not a forecast.

Prediction is separate from betting:

- A prediction may be recorded without any bet intent.
- A bet intent requires the stricter betting evidence gate.
- Prediction accuracy is evaluated by exact score and outcome only; it does not imply betting profit.

## Required Workflow

1. Read local `matches` and existing `codex_predictions`.
2. Sort upcoming matches by kickoff time and predict before kickoff.
3. For each prediction, gather the best available pre-match evidence:
   - current odds or market baseline when available;
   - recent form and strength signal;
   - injuries, suspensions, lineup or team-news uncertainty;
   - tactical matchup and likely scoring environment;
   - opposing evidence.
4. Produce a scoreline, outcome, confidence, rationale, and risk note.
5. Write the prediction through `POST /api/predictions` when the app service is available.
6. After final result is known, update the same prediction with actual score and hit flags.

## API Shape

Use:

```http
POST /api/predictions
```

Required fields:

- `matchId`
- `predictedBy`: usually `codex`
- `predictionScope`: usually `full_time`
- `predictedHomeScore`
- `predictedAwayScore`
- `confidence`: `low`, `medium`, or `high`
- `dataMode`: `offline`, `prior_analysis`, or `live_research`
- `rationale`
- `riskNote`

Optional final-result fields:

- `actualHomeScore`
- `actualAwayScore`
- `resultSourceNote`
- `resultCheckedAt`

## Output Discipline

For user-facing summaries, use:

```text
Codex 预测：
比赛：
预测比分：
胜平负：
置信度：
依据：
风险：
是否转下注：否/观察/另行评估
```

If there is not enough time to research every detail before kickoff, make the best bounded pre-match prediction and mark the data limitations in `riskNote`; do not skip an upcoming match because research is imperfect.
