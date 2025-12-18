CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`actor_user_id` text,
	`entity` text NOT NULL,
	`entity_id` text,
	`action` text NOT NULL,
	`diff` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_store_id_idx` ON `audit_logs` (`store_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_idx` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`line_user_id` text NOT NULL,
	`line_display_name` text,
	`call_name` text,
	`assigned_cast_id` text,
	`messaging_status` text DEFAULT 'active' NOT NULL,
	`tags` text,
	`notes` text,
	`last_visit_at` integer,
	`last_message_sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_cast_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `customers_store_line_user_idx` ON `customers` (`store_id`,`line_user_id`);--> statement-breakpoint
CREATE INDEX `customers_assigned_cast_idx` ON `customers` (`assigned_cast_id`);--> statement-breakpoint
CREATE INDEX `customers_store_id_idx` ON `customers` (`store_id`);--> statement-breakpoint
CREATE TABLE `inbound_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text,
	`line_user_id` text NOT NULL,
	`message_type` text NOT NULL,
	`body` text,
	`received_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inbound_messages_customer_id_idx` ON `inbound_messages` (`customer_id`);--> statement-breakpoint
CREATE INDEX `inbound_messages_store_id_idx` ON `inbound_messages` (`store_id`);--> statement-breakpoint
CREATE INDEX `inbound_messages_received_at_idx` ON `inbound_messages` (`received_at`);--> statement-breakpoint
CREATE TABLE `line_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`channel_access_token` text NOT NULL,
	`channel_secret` text NOT NULL,
	`bot_user_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `line_channels_bot_user_id_unique` ON `line_channels` (`bot_user_id`);--> statement-breakpoint
CREATE INDEX `line_channels_store_id_idx` ON `line_channels` (`store_id`);--> statement-breakpoint
CREATE INDEX `line_channels_bot_user_id_idx` ON `line_channels` (`bot_user_id`);--> statement-breakpoint
CREATE TABLE `message_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`cast_id` text NOT NULL,
	`template_id` text,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`api_response` text,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cast_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `message_logs_customer_id_idx` ON `message_logs` (`customer_id`);--> statement-breakpoint
CREATE INDEX `message_logs_cast_id_idx` ON `message_logs` (`cast_id`);--> statement-breakpoint
CREATE INDEX `message_logs_store_id_idx` ON `message_logs` (`store_id`);--> statement-breakpoint
CREATE INDEX `message_logs_sent_at_idx` ON `message_logs` (`sent_at`);--> statement-breakpoint
CREATE TABLE `registration_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`cast_id` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by_customer_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cast_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by_customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `registration_codes_store_code_idx` ON `registration_codes` (`store_id`,`code`);--> statement-breakpoint
CREATE INDEX `registration_codes_cast_id_idx` ON `registration_codes` (`cast_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`allowed_sending_start_time` text DEFAULT '12:00' NOT NULL,
	`allowed_sending_end_time` text DEFAULT '22:30' NOT NULL,
	`messaging_frequency_limit_hours` integer DEFAULT 24 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`scope` text NOT NULL,
	`owner_cast_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_cast_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `templates_store_id_scope_idx` ON `templates` (`store_id`,`scope`);--> statement-breakpoint
CREATE INDEX `templates_owner_cast_id_idx` ON `templates` (`owner_cast_id`);--> statement-breakpoint
CREATE TABLE `todo_generation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`rule_type` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`days_after_last_visit` integer,
	`cron_schedule` text DEFAULT '0 12 * * *' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_generation_rules_store_id_idx` ON `todo_generation_rules` (`store_id`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`cast_id` text NOT NULL,
	`type` text NOT NULL,
	`due_date` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cast_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todos_cast_id_status_idx` ON `todos` (`cast_id`,`status`);--> statement-breakpoint
CREATE INDEX `todos_customer_id_type_idx` ON `todos` (`customer_id`,`type`);--> statement-breakpoint
CREATE INDEX `todos_store_id_idx` ON `todos` (`store_id`);--> statement-breakpoint
CREATE INDEX `todos_due_date_idx` ON `todos` (`due_date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `users_store_email_idx` ON `users` (`store_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_store_id_idx` ON `users` (`store_id`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`approx_spend` integer,
	`nomination_type` text,
	`memo` text,
	`registered_by_cast_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registered_by_cast_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `visits_customer_id_idx` ON `visits` (`customer_id`);--> statement-breakpoint
CREATE INDEX `visits_store_id_idx` ON `visits` (`store_id`);--> statement-breakpoint
CREATE INDEX `visits_occurred_at_idx` ON `visits` (`occurred_at`);