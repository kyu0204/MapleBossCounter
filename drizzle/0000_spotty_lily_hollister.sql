CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_cache_expires_idx` ON `api_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `boss_clears` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`character_id` integer NOT NULL,
	`week_start` text NOT NULL,
	`boss` text NOT NULL,
	`difficulty` text NOT NULL,
	`cycle` text NOT NULL,
	`registered` integer NOT NULL,
	`completed` integer NOT NULL,
	`list_order_no` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `scheduler_snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `boss_clears_char_week_idx` ON `boss_clears` (`character_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `boss_clears_boss_idx` ON `boss_clears` (`boss`,`difficulty`,`week_start`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ocid` text NOT NULL,
	`name` text NOT NULL,
	`world` text,
	`class` text,
	`level` integer,
	`image_url` text,
	`owner_user_id` text,
	`account_id` text,
	`hidden` integer DEFAULT false NOT NULL,
	`cur_power` integer,
	`cur_power_at` text,
	`cur_setup_hashes` text,
	`best_power` integer,
	`best_power_at` text,
	`best_setup_hash` text,
	`superseded_by` integer,
	`basic_fetched_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_ocid_unique` ON `characters` (`ocid`);--> statement-breakpoint
CREATE INDEX `characters_name_idx` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `characters_owner_idx` ON `characters` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `characters_world_idx` ON `characters` (`world`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_name` text NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`finished_at` text,
	`status` text DEFAULT 'running' NOT NULL,
	`stats` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `job_runs_name_idx` ON `job_runs` (`job_name`,`started_at`);--> statement-breakpoint
CREATE TABLE `nexon_keys` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enc_key` text NOT NULL,
	`key_hint` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`account_ids` text DEFAULT '[]' NOT NULL,
	`last_ok_at` text,
	`last_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text,
	`boss` text NOT NULL,
	`difficulty` text NOT NULL,
	`world` text,
	`schedule_note` text,
	`memo` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `parties_owner_idx` ON `parties` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `parties_boss_idx` ON `parties` (`boss`,`difficulty`);--> statement-breakpoint
CREATE TABLE `party_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`party_id` integer NOT NULL,
	`nickname` text NOT NULL,
	`character_id` integer,
	`is_leader` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `party_members_unique` ON `party_members` (`party_id`,`nickname`);--> statement-breakpoint
CREATE INDEX `party_members_nick_idx` ON `party_members` (`nickname`);--> statement-breakpoint
CREATE INDEX `party_members_char_idx` ON `party_members` (`character_id`);--> statement-breakpoint
CREATE TABLE `plan_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`world` text NOT NULL,
	`config` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_configs_unique` ON `plan_configs` (`user_id`,`world`);--> statement-breakpoint
CREATE TABLE `power_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` integer NOT NULL,
	`power` integer NOT NULL,
	`setup_hash` text,
	`measured_at` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `power_log_char_idx` ON `power_log` (`character_id`,`measured_at`);--> statement-breakpoint
CREATE TABLE `scheduler_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` integer NOT NULL,
	`snapshot_date` text NOT NULL,
	`kind` text NOT NULL,
	`week_start` text NOT NULL,
	`weekly_clear_count` integer DEFAULT 0 NOT NULL,
	`weekly_limit` integer DEFAULT 12 NOT NULL,
	`raw` text NOT NULL,
	`fetched_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sched_snap_unique` ON `scheduler_snapshots` (`character_id`,`snapshot_date`,`kind`);--> statement-breakpoint
CREATE INDEX `sched_snap_week_idx` ON `scheduler_snapshots` (`character_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
