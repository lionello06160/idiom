CREATE TABLE `game_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL
);
