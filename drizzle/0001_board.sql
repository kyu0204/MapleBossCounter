CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`applicant_user_id` text NOT NULL,
	`character_id` integer NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`applicant_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_unique` ON `applications` (`post_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `applications_post_idx` ON `applications` (`post_id`,`status`);--> statement-breakpoint
CREATE INDEX `applications_user_idx` ON `applications` (`applicant_user_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_user_id` text NOT NULL,
	`party_id` integer,
	`boss` text NOT NULL,
	`difficulty` text NOT NULL,
	`world` text,
	`title` text NOT NULL,
	`body` text,
	`slots` integer DEFAULT 1 NOT NULL,
	`min_power` integer,
	`schedule_note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_boss_idx` ON `posts` (`boss`,`difficulty`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author_user_id`);