# Repo-local Codex skills

This directory contains Codex skills that ship with the repository. They are
intended to make prediction, analysis, betting-plan, parlay, odds-capture,
slip-recording, settlement, and review workflows usable by other Codex users
after cloning the repo.

## Skills

| Skill | Purpose |
|---|---|
| `wordcup-space` | Umbrella entrypoint for this World Cup workspace. |
| `codex-match-predictor` | Score prediction workflow and prediction review. |
| `codex-betting-operator` | Betting analysis, bankroll discipline, parlays, execution hygiene, slip recording, settlement review. |
| `football-data` | Football data helper skill from sports-skills. |
| `betting` | Pure odds math: conversion, de-vig, EV, Kelly, parlay analysis. |
| `markets` | Prediction-market comparison helpers where available. |

## Example prompts

```text
使用 wordcup-space，帮我初始化本地世界杯工作台。
```

```text
使用 wordcup-space，分析明天四场比赛，先预测比分，再给单关和串关计划。
```

```text
使用 codex-betting-operator，我发一张下注成功截图，你帮我 dry-run 录入。
```

## Safety

These skills do not authorize external bet submission. Real-money submission
requires the local user's own bookmaker account and explicit confirmation.

