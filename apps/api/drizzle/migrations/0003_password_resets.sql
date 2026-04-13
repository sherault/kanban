CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hashed_token` text NOT NULL UNIQUE,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
