PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bet_slips` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_intent_id` text NOT NULL,
	`execution_attempt_id` text NOT NULL,
	`platform_account_id` text NOT NULL,
	`portfolio_id` text NOT NULL,
	`decision_by` text NOT NULL,
	`placed_by` text DEFAULT 'user' NOT NULL,
	`is_real_money` integer DEFAULT true NOT NULL,
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
INSERT INTO `__new_bet_slips`("id", "bet_intent_id", "execution_attempt_id", "platform_account_id", "portfolio_id", "decision_by", "placed_by", "is_real_money", "mode", "stake_cents", "final_odds", "potential_return_cents", "confirmation_ref", "confirmation_screenshot_path", "status", "placed_at", "settled_at", "created_at", "updated_at") SELECT "id", "bet_intent_id", "execution_attempt_id", "platform_account_id", "portfolio_id", "decision_by", "placed_by", "is_real_money", "mode", "stake_cents", "final_odds", "potential_return_cents", "confirmation_ref", "confirmation_screenshot_path", "status", "placed_at", "settled_at", "created_at", "updated_at" FROM `bet_slips`;--> statement-breakpoint
DROP TABLE `bet_slips`;--> statement-breakpoint
ALTER TABLE `__new_bet_slips` RENAME TO `bet_slips`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `slips_portfolio_idx` ON `bet_slips` (`portfolio_id`,`status`);--> statement-breakpoint
CREATE INDEX `slips_intent_idx` ON `bet_slips` (`bet_intent_id`);--> statement-breakpoint
CREATE TABLE `__new_portfolio_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_after_cents` integer NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`is_real_money` integer DEFAULT true NOT NULL,
	`bet_slip_id` text,
	`source_actor` text DEFAULT 'system' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_portfolio_ledger_entries`("id", "portfolio_id", "entry_type", "amount_cents", "balance_after_cents", "currency", "is_real_money", "bet_slip_id", "source_actor", "notes", "created_at") SELECT "id", "portfolio_id", "entry_type", "amount_cents", "balance_after_cents", "currency", "is_real_money", "bet_slip_id", "source_actor", "notes", "created_at" FROM `portfolio_ledger_entries`;--> statement-breakpoint
DROP TABLE `portfolio_ledger_entries`;--> statement-breakpoint
ALTER TABLE `__new_portfolio_ledger_entries` RENAME TO `portfolio_ledger_entries`;--> statement-breakpoint
CREATE INDEX `ledger_portfolio_idx` ON `portfolio_ledger_entries` (`portfolio_id`,`created_at`);