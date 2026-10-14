-- Written by hand: D1 applies migrations in a transaction with foreign keys on,
-- so PRAGMA foreign_keys=OFF does nothing and dropping a parent table would
-- cascade-delete its children. The board that existed before projects becomes
-- the demo project, and its admins become the project's owners.
CREATE TABLE `project` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_member` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `project_member_pk` PRIMARY KEY(`project_id`, `user_id`),
	CONSTRAINT `fk_project_member_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_project_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `project` (`id`, `slug`, `name`, `description`, `created_at`)
SELECT 'demo', 'demo', 'Demo', '', strftime('%s', 'now') * 1000
WHERE EXISTS (SELECT 1 FROM `feedback`) OR EXISTS (SELECT 1 FROM `feedback_tag`);
--> statement-breakpoint
INSERT INTO `project_member` (`project_id`, `user_id`, `role`, `created_at`)
SELECT 'demo', `id`, 'owner', strftime('%s', 'now') * 1000 FROM `user`
WHERE `role` = 'admin' AND EXISTS (SELECT 1 FROM `project` WHERE `id` = 'demo');
--> statement-breakpoint
ALTER TABLE `feedback` ADD `project_id` text REFERENCES project(id) ON DELETE CASCADE;--> statement-breakpoint
UPDATE `feedback` SET `project_id` = 'demo';--> statement-breakpoint
CREATE INDEX `feedback_project_idx` ON `feedback` (`project_id`);--> statement-breakpoint
CREATE TABLE `feedback_category` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'blue' NOT NULL,
	CONSTRAINT `fk_feedback_category_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `feedback_category` (`id`, `project_id`, `name`, `color`) SELECT `id`, 'demo', `name`, `color` FROM `feedback_tag`;--> statement-breakpoint
CREATE UNIQUE INDEX `category_project_name_idx` ON `feedback_category` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_feedback_tags` (
	`post_id` text NOT NULL,
	`tag_id` text NOT NULL,
	CONSTRAINT `feedback_tags_pk` PRIMARY KEY(`post_id`, `tag_id`),
	CONSTRAINT `fk_feedback_tags_post_id_feedback_id_fk` FOREIGN KEY (`post_id`) REFERENCES `feedback`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_feedback_tags_tag_id_feedback_category_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `feedback_category`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_feedback_tags` (`post_id`, `tag_id`) SELECT `post_id`, `tag_id` FROM `feedback_tags`;--> statement-breakpoint
DROP TABLE `feedback_tags`;--> statement-breakpoint
ALTER TABLE `__new_feedback_tags` RENAME TO `feedback_tags`;--> statement-breakpoint
-- Nothing references the old table any more, so dropping it deletes nothing else.
DROP TABLE `feedback_tag`;--> statement-breakpoint
CREATE INDEX `member_user_idx` ON `project_member` (`user_id`);
