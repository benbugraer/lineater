ALTER TABLE `labels` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
CREATE INDEX `labels_team_idx` ON `labels` (`team_id`);