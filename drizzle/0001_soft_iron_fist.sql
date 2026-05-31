CREATE TABLE `exam_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`fileName` varchar(512) NOT NULL,
	`fileType` varchar(32) NOT NULL,
	`fileKey` varchar(512),
	`questionCount` int NOT NULL DEFAULT 10,
	`status` enum('pending','processing','ready','error') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exam_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`questionText` text NOT NULL,
	`optionA` text NOT NULL,
	`optionB` text NOT NULL,
	`optionC` text NOT NULL,
	`optionD` text NOT NULL,
	`correctAnswer` enum('A','B','C','D') NOT NULL,
	`explanation` text,
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
