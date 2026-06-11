PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TEMP TABLE `__match_canonical` AS
WITH `candidates` AS (
  SELECT
    `matches`.*,
    (
      (SELECT count(*) FROM `odds_snapshots` WHERE `odds_snapshots`.`match_id` = `matches`.`id`) +
      (SELECT count(*) FROM `bet_intent_legs` WHERE `bet_intent_legs`.`match_id` = `matches`.`id`) +
      (SELECT count(*) FROM `bet_slip_legs` WHERE `bet_slip_legs`.`match_id` = `matches`.`id`) +
      (SELECT count(*) FROM `match_results` WHERE `match_results`.`match_id` = `matches`.`id`)
    ) AS `ref_count`
  FROM `matches`
  WHERE `match_number` IS NOT NULL
),
`ranked` AS (
  SELECT
    `candidates`.*,
    count(*) OVER (
      PARTITION BY `competition`, `season`, `match_number`
    ) AS `duplicate_count`,
    first_value(`id`) OVER (
      PARTITION BY `competition`, `season`, `match_number`
      ORDER BY
        CASE WHEN `ref_count` > 0 THEN 1 ELSE 0 END DESC,
        CASE WHEN `data_source` = 'worldcup2026-api' THEN 1 ELSE 0 END DESC,
        `id` ASC
    ) AS `survivor_id`,
    first_value(`competition`) OVER `fact_window` AS `fact_competition`,
    first_value(`season`) OVER `fact_window` AS `fact_season`,
    first_value(`stage`) OVER `fact_window` AS `fact_stage`,
    first_value(`home_team`) OVER `fact_window` AS `fact_home_team`,
    first_value(`away_team`) OVER `fact_window` AS `fact_away_team`,
    first_value(`kickoff_at`) OVER `fact_window` AS `fact_kickoff_at`,
    first_value(`venue`) OVER `fact_window` AS `fact_venue`,
    first_value(`status`) OVER `fact_window` AS `fact_status`,
    first_value(`data_source`) OVER `fact_window` AS `fact_data_source`,
    first_value(`external_id`) OVER `fact_window` AS `fact_external_id`,
    first_value(`match_number`) OVER `fact_window` AS `fact_match_number`,
    first_value(`group_name`) OVER `fact_window` AS `fact_group_name`,
    first_value(`source_url`) OVER `fact_window` AS `fact_source_url`,
    first_value(`last_synced_at`) OVER `fact_window` AS `fact_last_synced_at`,
    first_value(`created_at`) OVER `fact_window` AS `fact_created_at`,
    first_value(`updated_at`) OVER `fact_window` AS `fact_updated_at`
  FROM `candidates`
  WINDOW `fact_window` AS (
    PARTITION BY `competition`, `season`, `match_number`
    ORDER BY
      CASE WHEN `data_source` = 'worldcup2026-api' THEN 1 ELSE 0 END DESC,
      `last_synced_at` DESC,
      `updated_at` DESC,
      `id` ASC
  )
)
SELECT DISTINCT
  `competition`,
  `season`,
  `match_number`,
  `survivor_id`,
  `fact_competition`,
  `fact_season`,
  `fact_stage`,
  `fact_home_team`,
  `fact_away_team`,
  `fact_kickoff_at`,
  `fact_venue`,
  `fact_status`,
  `fact_data_source`,
  `fact_external_id`,
  `fact_match_number`,
  `fact_group_name`,
  `fact_source_url`,
  `fact_last_synced_at`,
  `fact_created_at`,
  `fact_updated_at`
FROM `ranked`
WHERE `duplicate_count` > 1;--> statement-breakpoint
CREATE TEMP TABLE `__match_rewrites` AS
SELECT
  `matches`.`id` AS `match_id`,
  `__match_canonical`.`survivor_id` AS `survivor_id`
FROM `matches`
INNER JOIN `__match_canonical`
  ON `matches`.`competition` = `__match_canonical`.`competition`
  AND `matches`.`season` = `__match_canonical`.`season`
  AND `matches`.`match_number` = `__match_canonical`.`match_number`;--> statement-breakpoint
UPDATE `odds_snapshots`
SET `match_id` = (
  SELECT `survivor_id` FROM `__match_rewrites` WHERE `__match_rewrites`.`match_id` = `odds_snapshots`.`match_id`
)
WHERE `match_id` IN (SELECT `match_id` FROM `__match_rewrites` WHERE `match_id` <> `survivor_id`);--> statement-breakpoint
UPDATE `bet_intent_legs`
SET `match_id` = (
  SELECT `survivor_id` FROM `__match_rewrites` WHERE `__match_rewrites`.`match_id` = `bet_intent_legs`.`match_id`
)
WHERE `match_id` IN (SELECT `match_id` FROM `__match_rewrites` WHERE `match_id` <> `survivor_id`);--> statement-breakpoint
UPDATE `bet_slip_legs`
SET `match_id` = (
  SELECT `survivor_id` FROM `__match_rewrites` WHERE `__match_rewrites`.`match_id` = `bet_slip_legs`.`match_id`
)
WHERE `match_id` IN (SELECT `match_id` FROM `__match_rewrites` WHERE `match_id` <> `survivor_id`);--> statement-breakpoint
UPDATE `match_results`
SET `match_id` = (
  SELECT `survivor_id` FROM `__match_rewrites` WHERE `__match_rewrites`.`match_id` = `match_results`.`match_id`
)
WHERE `match_id` IN (SELECT `match_id` FROM `__match_rewrites` WHERE `match_id` <> `survivor_id`);--> statement-breakpoint
DELETE FROM `matches`
WHERE `id` IN (SELECT `match_id` FROM `__match_rewrites` WHERE `match_id` <> `survivor_id`);--> statement-breakpoint
UPDATE `matches`
SET
  `competition` = (SELECT `fact_competition` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `season` = (SELECT `fact_season` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `stage` = (SELECT `fact_stage` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `home_team` = (SELECT `fact_home_team` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `away_team` = (SELECT `fact_away_team` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `kickoff_at` = (SELECT `fact_kickoff_at` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `venue` = (SELECT `fact_venue` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `status` = (SELECT `fact_status` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `data_source` = (SELECT `fact_data_source` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `external_id` = (SELECT `fact_external_id` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `match_number` = (SELECT `fact_match_number` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `group_name` = (SELECT `fact_group_name` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `source_url` = (SELECT `fact_source_url` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `last_synced_at` = (SELECT `fact_last_synced_at` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `created_at` = (SELECT `fact_created_at` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`),
  `updated_at` = (SELECT `fact_updated_at` FROM `__match_canonical` WHERE `__match_canonical`.`survivor_id` = `matches`.`id`)
WHERE `id` IN (SELECT `survivor_id` FROM `__match_canonical`);--> statement-breakpoint
DROP TABLE `__match_rewrites`;--> statement-breakpoint
DROP TABLE `__match_canonical`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `matches_competition_season_number_idx` ON `matches` (`competition`,`season`,`match_number`);
