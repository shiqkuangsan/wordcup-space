---
name: codex-match-predictor
description: Use when Codex predicts World Cup match scores in wordcup-space, especially weekly pre-match score forecasts, recording predictions through /api/predictions, checking final results, or reviewing prediction accuracy. This is separate from betting decisions.
---

# Codex Match Predictor

This skill governs Codex score prediction records for `wordcup-space`.

## Prime Directive

Never create a prediction after the match has already started or ended. If kickoff time has passed, record only a result/review, not a forecast.

Only predict the current local week. In this project, "this week" means the user's local calendar week in `Asia/Taipei`, from now until Sunday 23:59:59. Do not pre-fill next week, later group-stage rounds, knockout matches, or any fixture outside the current weekly window.

Score prediction is the primary World Cup tracking task. Betting decisions are
downstream of the score prediction, not the other way around. For every match
Codex chooses to cover, create or refresh the score prediction first, then decide
whether that scoreline creates any bet intent.

Prediction is separate from betting:

- A prediction may be recorded without any bet intent.
- A bet intent requires the stricter betting evidence gate.
- Prediction accuracy is evaluated by exact score. Win/draw/loss is only derived from the score when internal statistics need it; do not present it as a separate forecast.
- A predicted score must not automatically become a correct-score bet, draw bet,
  or exact outcome bet. Betting markets require independent price/value
  evidence.
- If the predicted score suggests a market but the evidence gate is weak, record
  the score prediction and mark betting as `观察` or `否`.

## Required Workflow

1. Read local `matches` and existing `codex_predictions`.
2. Build the candidate pool from matches that are both:
   - not started yet; and
   - inside the current local-week window.
3. Sort weekly candidates by kickoff time.
4. For each candidate, gather the best available pre-match evidence:
   - current odds or market baseline when available;
   - group standings, qualification path, third-place qualification pressure,
     goal-difference incentives, and final-round opponent when in the group
     stage;
   - recent form and strength signal;
   - injuries, suspensions, lineup or team-news uncertainty;
   - host-country or quasi-home advantage for USA, Canada, and Mexico in the
     2026 World Cup;
   - tactical matchup and likely scoring environment;
   - opposing evidence.
5. Build a structured probability baseline before choosing a scoreline:
   - Prefer the local TypeScript model in `src/domain/prediction-model.ts` when
     team ratings or a justified rating proxy are available.
   - The model output must include `modelVersion`, expected goals, win/draw/loss
     probabilities, top score distribution, and a `mainPrediction`.
   - The headline score must match the headline outcome direction. If the
     single most likely score is a draw but the highest outcome probability is a
     home win, the draw can only be listed as a score-distribution reference.
   - Store the model output as `modelSnapshot` when calling
     `POST /api/predictions`; it will be preserved in `sources_json` alongside
     human-readable sources.
   - If ratings are missing or stale, do not fabricate a model. Mark the model
     baseline as unavailable and rely on evidence notes instead.
6. Decide one of three actions:
   - `predict`: produce a scoreline, confidence, rationale, and risk note;
   - `defer`: wait for more information such as odds, lineup, injuries, or weather;
   - `abstain`: explicitly do not predict because the information quality is too poor or the match context is outside Codex's current edge.
7. Write only `predict` decisions through `POST /api/predictions` when the app service is available. Do not create fake score rows for `defer` or `abstain` unless the app later adds a first-class abstention record type.
8. When rerun before kickoff, re-check new information and update an existing prediction if the new evidence materially changes the view. Record the changed rationale and risk note.
9. After final result is known, update the same prediction with actual score and hit flags.

## Prediction Gate

- The weekly candidate pool is not a to-do list to fill. It is a watchlist.
- Default to `defer` unless there is enough edge to justify a concrete scoreline.
- Do not write a score prediction when the final decision is low confidence. Low confidence means "watch", not "publish a weak prediction".
- A `predict` action should usually have at least one concrete anchor: live market baseline, verified team news, stable strength gap, matchup edge, or a clear tactical scoring environment.
- A local probability model is an anchor only when its input ratings are named
  and defensible. It is not an excuse to publish weak predictions from stale
  sample ratings.
- When model probability and qualitative evidence disagree, downgrade
  confidence or `defer`; do not hide the disagreement.
- For 2026 World Cup matches involving USA, Canada, or Mexico, explicitly assess
  home/co-host advantage. This factor can support edge or confidence, but it
  must not automatically force a home-win prediction.
- For group-stage matchweek two and three, explicitly assess qualification
  incentives before publishing a scoreline. The 2026 format sends each group
  top two plus the best eight third-placed teams to the round of 32, so points,
  goal difference, goals scored, and final-round opponent can change whether a
  team protects a draw, chases margin, or takes late risk.
- Use `defer` for matches that need closer kickoff information, especially lineups, injury confirmation, late odds movement, weather, venue impact, or first-round form.
- Use `abstain` when the match has no meaningful Codex edge even after checking available information.

## Rerun Discipline

- This skill is expected to be run repeatedly during the week.
- A rerun is not a command to predict everything; it is a fresh weekly scan.
- User and Codex may ask for the same weekly scan multiple times as odds, team news, injuries, weather, or lineup information changes.
- If a previous prediction becomes weak after new evidence, update it before kickoff or mark it in the user-facing summary as needing reassessment.
- Never wait until after kickoff to "fix" a forecast. After kickoff, only settle or review.
- When a betting decision is requested, first state the current score prediction
  and whether it changed. Only then discuss singles, parlays, stake size, or
  execution.
- Do not rewrite a prediction after kickoff. If live play exposes that the
  pre-match prediction was wrong, preserve it and use the result for review.

## Prediction Review Discipline

After a result is known:

- Evaluate exact-score hit first.
- Separately note whether the derived match outcome was right.
- If a related bet existed, review whether the bet failed because the score
  prediction was wrong, because the chosen market was too narrow, because
  execution price was bad, or because variance was acceptable.
- Use early tournament matches as calibration samples. Do not overfit one upset
  or one late comeback into a broad rule.

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
- `modelSnapshot`: optional structured probability output from
  `src/domain/prediction-model.ts`, saved with `sources_json`

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
动作：预测 / 暂缓 / 不预测
预测比分：仅在动作为“预测”时填写
置信度：
模型底座：可用 / 不可用；若可用，写 expected goals、胜/平/负概率、模型版本
依据：
风险：
是否转下注：否/观察/另行评估
```

If information is incomplete, do not force a scoreline. Use `defer` when more information may arrive before kickoff, or `abstain` when Codex has no meaningful edge.
