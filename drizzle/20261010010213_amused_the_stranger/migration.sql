CREATE TABLE `feedback_comment` (
	`id` text PRIMARY KEY,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_feedback_comment_post_id_feedback_id_fk` FOREIGN KEY (`post_id`) REFERENCES `feedback`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_feedback_comment_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`author_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`merged_into_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_feedback_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback_tags` (
	`post_id` text NOT NULL,
	`tag_id` text NOT NULL,
	CONSTRAINT `feedback_tags_pk` PRIMARY KEY(`post_id`, `tag_id`),
	CONSTRAINT `fk_feedback_tags_post_id_feedback_id_fk` FOREIGN KEY (`post_id`) REFERENCES `feedback`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_feedback_tags_tag_id_feedback_tag_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `feedback_tag`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `feedback_update` (
	`id` text PRIMARY KEY,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_feedback_update_post_id_feedback_id_fk` FOREIGN KEY (`post_id`) REFERENCES `feedback`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_feedback_update_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback_tag` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`color` text DEFAULT 'blue' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback_vote` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `feedback_vote_pk` PRIMARY KEY(`post_id`, `user_id`),
	CONSTRAINT `fk_feedback_vote_post_id_feedback_id_fk` FOREIGN KEY (`post_id`) REFERENCES `feedback`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_feedback_vote_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `wishbox_meta` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comment_post_idx` ON `feedback_comment` (`post_id`);--> statement-breakpoint
CREATE INDEX `feedback_status_idx` ON `feedback` (`status`);--> statement-breakpoint
CREATE INDEX `feedback_author_idx` ON `feedback` (`author_id`);