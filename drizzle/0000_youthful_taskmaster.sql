CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`notes` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bet_intent_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_intent_id` text NOT NULL,
	`match_id` text NOT NULL,
	`market` text NOT NULL,
	`selection` text NOT NULL,
	`line` text,
	`intended_odds` real NOT NULL,
	`leg_order` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`bet_intent_id`) REFERENCES `bet_intents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `intent_legs_intent_idx` ON `bet_intent_legs` (`bet_intent_id`,`leg_order`);--> statement-breakpoint
CREATE TABLE `bet_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`decision_by` text NOT NULL,
	`mode` text NOT NULL,
	`market` text,
	`intended_stake_cents` integer NOT NULL,
	`intended_total_odds` real NOT NULL,
	`risk_tier` text NOT NULL,
	`confidence` text NOT NULL,
	`model_probability` real,
	`expected_value` real,
	`status` text DEFAULT 'draft' NOT NULL,
	`approval_mode` text DEFAULT 'auto' NOT NULL,
	`rationale` text NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `intent_status_idx` ON `bet_intents` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `bet_slip_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_slip_id` text NOT NULL,
	`match_id` text NOT NULL,
	`market` text NOT NULL,
	`selection` text NOT NULL,
	`line` text,
	`final_odds` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`leg_order` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`bet_slip_id`) REFERENCES `bet_slips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `slip_legs_slip_idx` ON `bet_slip_legs` (`bet_slip_id`,`leg_order`);--> statement-breakpoint
CREATE TABLE `bet_slips` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_intent_id` text NOT NULL,
	`execution_attempt_id` text NOT NULL,
	`platform_account_id` text NOT NULL,
	`portfolio_id` text NOT NULL,
	`decision_by` text NOT NULL,
	`placed_by` text DEFAULT 'user' NOT NULL,
	`is_real_money` integer DEFAULT false NOT NULL,
	`mode` text NOT NULL,
	`stake_cents` integer NOT NULL,
	`final_odds` real NOT NULL,
	`potential_return_cents` integer NOT NULL,
	`confirmation_ref` text,
	`confirmation_screenshot_path` text,
	`status` text DEFAULT 'open' NOT NULL,
	`placed_at` text NOT NULL,
	`settled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bet_intent_id`) REFERENCES `bet_intents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`execution_attempt_id`) REFERENCES `execution_attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_account_id`) REFERENCES `platform_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `slips_portfolio_idx` ON `bet_slips` (`portfolio_id`,`status`);--> statement-breakpoint
CREATE INDEX `slips_intent_idx` ON `bet_slips` (`bet_intent_id`);--> statement-breakpoint
CREATE TABLE `decision_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_slip_id` text,
	`bet_intent_id` text,
	`reviewer` text DEFAULT 'user' NOT NULL,
	`rating` text,
	`review_note` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bet_slip_id`) REFERENCES `bet_slips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bet_intent_id`) REFERENCES `bet_intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `execution_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_intent_id` text NOT NULL,
	`execution_method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`platform_account_id` text,
	`intended_odds` real NOT NULL,
	`observed_odds` real,
	`odds_change_pct` real,
	`odds_tolerance_pct` real DEFAULT 0.06 NOT NULL,
	`failure_reason` text,
	`started_at` text,
	`finished_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bet_intent_id`) REFERENCES `bet_intents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_account_id`) REFERENCES `platform_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attempt_intent_idx` ON `execution_attempts` (`bet_intent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `match_results` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`result_status` text DEFAULT 'pending' NOT NULL,
	`source_actor` text DEFAULT 'user' NOT NULL,
	`source_note` text,
	`settled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`competition` text NOT NULL,
	`season` text NOT NULL,
	`stage` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`kickoff_at` text NOT NULL,
	`venue` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`data_source` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `matches_kickoff_idx` ON `matches` (`kickoff_at`);--> statement-breakpoint
CREATE TABLE `odds_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`bookmaker` text NOT NULL,
	`market` text NOT NULL,
	`selection` text NOT NULL,
	`line` text,
	`decimal_odds` real NOT NULL,
	`captured_at` text NOT NULL,
	`created_by` text NOT NULL,
	`source_actor` text NOT NULL,
	`source_type` text NOT NULL,
	`source_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `odds_match_idx` ON `odds_snapshots` (`match_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `platform_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`account_label` text NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolio_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_after_cents` integer NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`is_real_money` integer DEFAULT false NOT NULL,
	`bet_slip_id` text,
	`source_actor` text DEFAULT 'system' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_portfolio_idx` ON `portfolio_ledger_entries` (`portfolio_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_actor` text NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`allocated_balance_cents` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `risk_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_actor` text NOT NULL,
	`single_stake_limit_pct` real NOT NULL,
	`high_confidence_stake_limit_pct` real NOT NULL,
	`parlay_stake_limit_pct` real NOT NULL,
	`max_parlay_legs` integer NOT NULL,
	`daily_loss_limit_pct` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_slip_id` text NOT NULL,
	`result` text NOT NULL,
	`payout_cents` integer NOT NULL,
	`profit_loss_cents` integer NOT NULL,
	`settled_by` text DEFAULT 'user' NOT NULL,
	`source_note` text NOT NULL,
	`settled_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bet_slip_id`) REFERENCES `bet_slips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `settlements_slip_idx` ON `settlements` (`bet_slip_id`);