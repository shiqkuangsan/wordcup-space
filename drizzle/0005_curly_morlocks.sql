CREATE TABLE `codex_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`predicted_by` text DEFAULT 'codex' NOT NULL,
	`prediction_scope` text DEFAULT 'full_time' NOT NULL,
	`predicted_home_score` integer NOT NULL,
	`predicted_away_score` integer NOT NULL,
	`predicted_outcome` text NOT NULL,
	`confidence` text NOT NULL,
	`data_mode` text DEFAULT 'offline' NOT NULL,
	`rationale` text NOT NULL,
	`risk_note` text NOT NULL,
	`sources_json` text,
	`status` text DEFAULT 'predicted' NOT NULL,
	`predicted_at` text NOT NULL,
	`actual_home_score` integer,
	`actual_away_score` integer,
	`actual_outcome` text,
	`score_hit` integer,
	`outcome_hit` integer,
	`result_source_note` text,
	`result_checked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `predictions_match_idx` ON `codex_predictions` (`match_id`,`predicted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `predictions_match_actor_scope_idx` ON `codex_predictions` (`match_id`,`predicted_by`,`prediction_scope`);--> statement-breakpoint
CREATE INDEX `predictions_status_idx` ON `codex_predictions` (`status`,`predicted_at`);
