import { z } from "zod";

export const sessionIdSchema = z.object({
	sessionId: z.uuid(),
});

export const createSessionSchema = z.object({
	title: z.string().trim().min(1, "Title is required").max(100),
	targetLanguage: z.string().trim().min(1, "Target language is required"),
	helpLanguage: z.string().trim().min(1, "Help language is required"),
	startsAt: z.iso.datetime().transform((value) => new Date(value)),
	capacity: z
		.number()
		.int("Capacity must be an integer")
		.min(2, "Capacity must be at least 2")
		.max(20, "Capacity cannot exceed 20"),

	meetingLink: z.url("Meeting link must be a valid URL"),
	imageKey: z.string().nullable().optional(),
	description: z.string().trim().min(1, "Description is required").max(1000),
});

export type CreateSessionBody = z.infer<typeof createSessionSchema>;
