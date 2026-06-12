import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const platformAccounts = sqliteTable("platform_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  accountLabel: text("account_label").notNull(),
  currency: text("currency").notNull().default("CNY"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  ...timestamps,
});

export const portfolios = sqliteTable("portfolios", {
  id: text("id").primaryKey(),
  ownerActor: text("owner_actor").notNull(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("CNY"),
  allocatedBalanceCents: integer("allocated_balance_cents").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  ...timestamps,
});

export const portfolioLedgerEntries = sqliteTable(
  "portfolio_ledger_entries",
  {
    id: text("id").primaryKey(),
    portfolioId: text("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    entryType: text("entry_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    balanceAfterCents: integer("balance_after_cents").notNull(),
    currency: text("currency").notNull().default("CNY"),
    isRealMoney: integer("is_real_money", { mode: "boolean" }).notNull().default(true),
    betSlipId: text("bet_slip_id"),
    sourceActor: text("source_actor").notNull().default("system"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("ledger_portfolio_idx").on(table.portfolioId, table.createdAt)],
);

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    competition: text("competition").notNull(),
    season: text("season").notNull(),
    stage: text("stage").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    kickoffAt: text("kickoff_at").notNull(),
    venue: text("venue"),
    status: text("status").notNull().default("scheduled"),
    dataSource: text("data_source"),
    externalId: text("external_id"),
    matchNumber: integer("match_number"),
    groupName: text("group_name"),
    sourceUrl: text("source_url"),
    lastSyncedAt: text("last_synced_at"),
    ...timestamps,
  },
  (table) => [
    index("matches_kickoff_idx").on(table.kickoffAt),
    index("matches_status_stage_idx").on(table.status, table.stage),
    uniqueIndex("matches_competition_season_number_idx").on(table.competition, table.season, table.matchNumber),
    uniqueIndex("matches_source_external_idx").on(table.dataSource, table.externalId),
  ],
);

export const matchResults = sqliteTable("match_results", {
  id: text("id").primaryKey(),
  matchId: text("match_id")
    .notNull()
    .references(() => matches.id),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  resultStatus: text("result_status").notNull().default("pending"),
  sourceActor: text("source_actor").notNull().default("user"),
  sourceNote: text("source_note"),
  settledAt: text("settled_at"),
  ...timestamps,
});

export const codexPredictions = sqliteTable(
  "codex_predictions",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id),
    predictedBy: text("predicted_by").notNull().default("codex"),
    predictionScope: text("prediction_scope").notNull().default("full_time"),
    predictedHomeScore: integer("predicted_home_score").notNull(),
    predictedAwayScore: integer("predicted_away_score").notNull(),
    predictedOutcome: text("predicted_outcome").notNull(),
    confidence: text("confidence").notNull(),
    dataMode: text("data_mode").notNull().default("offline"),
    rationale: text("rationale").notNull(),
    riskNote: text("risk_note").notNull(),
    sourcesJson: text("sources_json"),
    status: text("status").notNull().default("predicted"),
    predictedAt: text("predicted_at").notNull(),
    actualHomeScore: integer("actual_home_score"),
    actualAwayScore: integer("actual_away_score"),
    actualOutcome: text("actual_outcome"),
    scoreHit: integer("score_hit", { mode: "boolean" }),
    outcomeHit: integer("outcome_hit", { mode: "boolean" }),
    resultSourceNote: text("result_source_note"),
    resultCheckedAt: text("result_checked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("predictions_match_actor_scope_idx").on(table.matchId, table.predictedBy, table.predictionScope),
    index("predictions_match_idx").on(table.matchId, table.predictedAt),
    index("predictions_status_idx").on(table.status, table.predictedAt),
  ],
);

export const oddsSnapshots = sqliteTable(
  "odds_snapshots",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id),
    bookmaker: text("bookmaker").notNull(),
    market: text("market").notNull(),
    selection: text("selection").notNull(),
    line: text("line"),
    decimalOdds: real("decimal_odds").notNull(),
    capturedAt: text("captured_at").notNull(),
    createdBy: text("created_by").notNull(),
    sourceActor: text("source_actor").notNull(),
    sourceType: text("source_type").notNull(),
    sourceNote: text("source_note"),
    ...timestamps,
  },
  (table) => [index("odds_match_idx").on(table.matchId, table.capturedAt)],
);

export const betIntents = sqliteTable(
  "bet_intents",
  {
    id: text("id").primaryKey(),
    portfolioId: text("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    decisionBy: text("decision_by").notNull(),
    mode: text("mode").notNull(),
    market: text("market"),
    intendedStakeCents: integer("intended_stake_cents").notNull(),
    intendedTotalOdds: real("intended_total_odds").notNull(),
    riskTier: text("risk_tier").notNull(),
    confidence: text("confidence").notNull(),
    modelProbability: real("model_probability"),
    expectedValue: real("expected_value"),
    status: text("status").notNull().default("draft"),
    approvalMode: text("approval_mode").notNull().default("auto"),
    rationale: text("rationale").notNull(),
    expiresAt: text("expires_at"),
    closedAt: text("closed_at"),
    closedReason: text("closed_reason"),
    closedNote: text("closed_note"),
    sourceIntentId: text("source_intent_id"),
    supersededByIntentId: text("superseded_by_intent_id"),
    ...timestamps,
  },
  (table) => [index("intent_status_idx").on(table.status, table.createdAt)],
);

export const betIntentLegs = sqliteTable(
  "bet_intent_legs",
  {
    id: text("id").primaryKey(),
    betIntentId: text("bet_intent_id")
      .notNull()
      .references(() => betIntents.id),
    matchId: text("match_id").references(() => matches.id),
    matchText: text("match_text"),
    market: text("market").notNull(),
    selection: text("selection").notNull(),
    line: text("line"),
    intendedOdds: real("intended_odds").notNull(),
    legOrder: integer("leg_order").notNull(),
    notes: text("notes"),
  },
  (table) => [index("intent_legs_intent_idx").on(table.betIntentId, table.legOrder)],
);

export const executionAttempts = sqliteTable(
  "execution_attempts",
  {
    id: text("id").primaryKey(),
    betIntentId: text("bet_intent_id")
      .notNull()
      .references(() => betIntents.id),
    executionMethod: text("execution_method").notNull(),
    status: text("status").notNull().default("pending"),
    platformAccountId: text("platform_account_id").references(() => platformAccounts.id),
    intendedOdds: real("intended_odds").notNull(),
    observedOdds: real("observed_odds"),
    oddsFormat: text("odds_format").notNull().default("decimal"),
    rawObservedOdds: real("raw_observed_odds"),
    oddsChangePct: real("odds_change_pct"),
    oddsTolerancePct: real("odds_tolerance_pct").notNull().default(0.06),
    failureReason: text("failure_reason"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("attempt_intent_idx").on(table.betIntentId, table.createdAt)],
);

export const betSlips = sqliteTable(
  "bet_slips",
  {
    id: text("id").primaryKey(),
    betIntentId: text("bet_intent_id")
      .notNull()
      .references(() => betIntents.id),
    executionAttemptId: text("execution_attempt_id")
      .notNull()
      .references(() => executionAttempts.id),
    platformAccountId: text("platform_account_id")
      .notNull()
      .references(() => platformAccounts.id),
    portfolioId: text("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    decisionBy: text("decision_by").notNull(),
    placedBy: text("placed_by").notNull().default("user"),
    isRealMoney: integer("is_real_money", { mode: "boolean" }).notNull().default(true),
    mode: text("mode").notNull(),
    stakeCents: integer("stake_cents").notNull(),
    finalOdds: real("final_odds").notNull(),
    oddsFormat: text("odds_format").notNull().default("decimal"),
    rawOdds: real("raw_odds"),
    potentialReturnCents: integer("potential_return_cents").notNull(),
    confirmationRef: text("confirmation_ref"),
    confirmationScreenshotPath: text("confirmation_screenshot_path"),
    status: text("status").notNull().default("open"),
    placedAt: text("placed_at").notNull(),
    settledAt: text("settled_at"),
    ...timestamps,
  },
  (table) => [
    index("slips_portfolio_idx").on(table.portfolioId, table.status),
    index("slips_intent_idx").on(table.betIntentId),
  ],
);

export const betSlipLegs = sqliteTable(
  "bet_slip_legs",
  {
    id: text("id").primaryKey(),
    betSlipId: text("bet_slip_id")
      .notNull()
      .references(() => betSlips.id),
    matchId: text("match_id").references(() => matches.id),
    matchText: text("match_text"),
    market: text("market").notNull(),
    selection: text("selection").notNull(),
    line: text("line"),
    finalOdds: real("final_odds").notNull(),
    oddsFormat: text("odds_format").notNull().default("decimal"),
    rawOdds: real("raw_odds"),
    status: text("status").notNull().default("open"),
    legOrder: integer("leg_order").notNull(),
    notes: text("notes"),
  },
  (table) => [index("slip_legs_slip_idx").on(table.betSlipId, table.legOrder)],
);

export const settlements = sqliteTable(
  "settlements",
  {
    id: text("id").primaryKey(),
    betSlipId: text("bet_slip_id")
      .notNull()
      .references(() => betSlips.id),
    result: text("result").notNull(),
    payoutCents: integer("payout_cents").notNull(),
    profitLossCents: integer("profit_loss_cents").notNull(),
    settledBy: text("settled_by").notNull().default("user"),
    sourceNote: text("source_note").notNull(),
    settledAt: text("settled_at").notNull(),
    ...timestamps,
  },
  (table) => [index("settlements_slip_idx").on(table.betSlipId)],
);

export const decisionReviews = sqliteTable("decision_reviews", {
  id: text("id").primaryKey(),
  betSlipId: text("bet_slip_id").references(() => betSlips.id),
  betIntentId: text("bet_intent_id").references(() => betIntents.id),
  reviewer: text("reviewer").notNull().default("user"),
  rating: text("rating"),
  reviewNote: text("review_note").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const riskProfiles = sqliteTable("risk_profiles", {
  id: text("id").primaryKey(),
  ownerActor: text("owner_actor").notNull(),
  singleStakeLimitPct: real("single_stake_limit_pct").notNull(),
  highConfidenceStakeLimitPct: real("high_confidence_stake_limit_pct").notNull(),
  parlayStakeLimitPct: real("parlay_stake_limit_pct").notNull(),
  maxParlayLegs: integer("max_parlay_legs").notNull(),
  dailyLossLimitPct: real("daily_loss_limit_pct").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  notes: text("notes"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const portfolioRelations = relations(portfolios, ({ many }) => ({
  ledgerEntries: many(portfolioLedgerEntries),
  betIntents: many(betIntents),
  betSlips: many(betSlips),
}));

export const matchRelations = relations(matches, ({ many }) => ({
  predictions: many(codexPredictions),
}));

export const codexPredictionRelations = relations(codexPredictions, ({ one }) => ({
  match: one(matches, {
    fields: [codexPredictions.matchId],
    references: [matches.id],
  }),
}));

export const betIntentRelations = relations(betIntents, ({ many, one }) => ({
  portfolio: one(portfolios, {
    fields: [betIntents.portfolioId],
    references: [portfolios.id],
  }),
  legs: many(betIntentLegs),
  executionAttempts: many(executionAttempts),
  betSlips: many(betSlips),
}));

export const betSlipRelations = relations(betSlips, ({ many, one }) => ({
  portfolio: one(portfolios, {
    fields: [betSlips.portfolioId],
    references: [portfolios.id],
  }),
  intent: one(betIntents, {
    fields: [betSlips.betIntentId],
    references: [betIntents.id],
  }),
  legs: many(betSlipLegs),
  settlements: many(settlements),
}));
