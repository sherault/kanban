ALTER TABLE `users` ADD `enable_notifications` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `max_notifications` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notification_duration` integer DEFAULT 5 NOT NULL;