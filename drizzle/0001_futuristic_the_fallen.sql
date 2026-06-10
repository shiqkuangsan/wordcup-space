ALTER TABLE `matches` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `match_number` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `group_name` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `last_synced_at` text;--> statement-breakpoint
CREATE INDEX `matches_status_stage_idx` ON `matches` (`status`,`stage`);--> statement-breakpoint
CREATE UNIQUE INDEX `matches_source_external_idx` ON `matches` (`data_source`,`external_id`);