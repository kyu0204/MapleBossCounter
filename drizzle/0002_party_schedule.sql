ALTER TABLE `parties` ADD `day_of_week` integer;--> statement-breakpoint
ALTER TABLE `parties` ADD `hour` integer;--> statement-breakpoint
ALTER TABLE `parties` ADD `minute` integer;--> statement-breakpoint
ALTER TABLE `parties` ADD `repeats` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `parties` ADD `week_start` text;
