DROP INDEX `issues_identifier_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `issues_team_number_unique` ON `issues` (`team_id`,`number`);--> statement-breakpoint
CREATE INDEX `issues_identifier_idx` ON `issues` (`identifier`);