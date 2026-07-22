import { z } from "zod";

export const sessionIdSchema = z.object({
	sessionId: z.uuid(),
});

export const createSessionSchema = z
	.object({
		title: z.string().trim().min(1, "Title is required").max(100),

		targetLanguage: z
			.string()
			.trim()
			.min(1, "Target language is required")
			.max(50),

		helpLanguage: z.string().trim().min(1, "Help language is required").max(50),

		startsAt: z.iso.datetime().transform((value) => new Date(value)),

		durationMinutes: z
			.number()
			.int("Duration must be an integer")
			.min(15, "Duration must be at least 15 minutes")
			.max(120, "Duration cannot exceed 120 minutes"),

		meetingLink: z.url("Meeting link must be a valid URL").refine((value) => {
			const protocol = new URL(value).protocol;
			return protocol === "https:" || protocol === "http:";
		}, "Meeting link must use HTTP or HTTPS"),

		imageKey: z.string().trim().min(1).max(500).nullable().optional(),

		description: z.string().trim().min(1, "Description is required").max(1000),
	})
	.strict();

export const updateSessionSchema = createSessionSchema
	.partial()
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});

export const listSessionsQuerySchema = z
	.object({
		limit: z.coerce
			.number()
			.int("Limit must be an integer")
			.min(1, "Limit must be at least 1")
			.max(50, "Limit cannot exceed 50")
			.default(20),
	})
	.strict();

export type CreateSessionBody = z.infer<typeof createSessionSchema>;
export type UpdateSessionBody = z.infer<typeof updateSessionSchema>;
