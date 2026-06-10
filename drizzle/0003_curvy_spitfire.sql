PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bet_intent_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_intent_id` text NOT NULL,
	`match_id` text,
	`match_text` text,
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
INSERT INTO `__new_bet_intent_legs`("id", "bet_intent_id", "match_id", "match_text", "market", "selection", "line", "intended_odds", "leg_order", "notes") SELECT "id", "bet_intent_id", "match_id", NULL, "market", "selection", "line", "intended_odds", "leg_order", "notes" FROM `bet_intent_legs`;--> statement-breakpoint
DROP TABLE `bet_intent_legs`;--> statement-breakpoint
ALTER TABLE `__new_bet_intent_legs` RENAME TO `bet_intent_legs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `intent_legs_intent_idx` ON `bet_intent_legs` (`bet_intent_id`,`leg_order`);--> statement-breakpoint
CREATE TABLE `__new_bet_slip_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`bet_slip_id` text NOT NULL,
	`match_id` text,
	`match_text` text,
	`market` text NOT NULL,
	`selection` text NOT NULL,
	`line` text,
	`final_odds` real NOT NULL,
	`odds_format` text DEFAULT 'decimal' NOT NULL,
	`raw_odds` real,
	`status` text DEFAULT 'open' NOT NULL,
	`leg_order` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`bet_slip_id`) REFERENCES `bet_slips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bet_slip_legs`("id", "bet_slip_id", "match_id", "match_text", "market", "selection", "line", "final_odds", "odds_format", "raw_odds", "status", "leg_order", "notes") SELECT "id", "bet_slip_id", "match_id", NULL, "market", "selection", "line", "final_odds", 'decimal', "final_odds", "status", "leg_order", "notes" FROM `bet_slip_legs`;--> statement-breakpoint
DROP TABLE `bet_slip_legs`;--> statement-breakpoint
ALTER TABLE `__new_bet_slip_legs` RENAME TO `bet_slip_legs`;--> statement-breakpoint
CREATE INDEX `slip_legs_slip_idx` ON `bet_slip_legs` (`bet_slip_id`,`leg_order`);--> statement-breakpoint
ALTER TABLE `bet_slips` ADD `odds_format` text DEFAULT 'decimal' NOT NULL;--> statement-breakpoint
ALTER TABLE `bet_slips` ADD `raw_odds` real;--> statement-breakpoint
UPDATE `bet_slips` SET `raw_odds` = `final_odds` WHERE `raw_odds` IS NULL;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD `odds_format` text DEFAULT 'decimal' NOT NULL;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD `raw_observed_odds` real;
