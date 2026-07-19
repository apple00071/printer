CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`file` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`time` text NOT NULL,
	`color` text DEFAULT 'bw' NOT NULL,
	`sides` text DEFAULT 'single' NOT NULL,
	`copies` integer DEFAULT 1 NOT NULL,
	`pages` integer DEFAULT 1 NOT NULL,
	`range` text DEFAULT 'All pages' NOT NULL,
	`kiosk_id` text,
	FOREIGN KEY (`kiosk_id`) REFERENCES `kiosks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kiosks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`ip` text NOT NULL,
	`status` text DEFAULT 'Online' NOT NULL,
	`paper` integer DEFAULT 100 NOT NULL,
	`toner` integer DEFAULT 100 NOT NULL
);
