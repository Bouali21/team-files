CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_item` ON `comments` (`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text,
	`size` integer DEFAULT 0 NOT NULL,
	`object_key` text,
	`trashed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `items_parent` ON `items` (`parent_id`);--> statement-breakpoint
CREATE INDEX `items_owner` ON `items` (`owner_id`);--> statement-breakpoint
CREATE TABLE `links` (
	`token` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`allow_download` integer DEFAULT false NOT NULL,
	`expires_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_item` ON `links` (`item_id`);--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shares_item_email` ON `shares` (`item_id`,`email`);--> statement-breakpoint
CREATE INDEX `shares_email` ON `shares` (`email`);--> statement-breakpoint
CREATE TABLE `stars` (
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`user_id`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
