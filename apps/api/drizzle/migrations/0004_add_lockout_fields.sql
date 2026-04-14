ALTER TABLE `users` ADD `failed_login_attempts` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD `lockout_until` text;
