import { z } from "zod";

export const createSessionRequestSchema = z
	.object({
		message: z
			.string()
			.trim()
			.min(1, "Message cannot be empty")
			.max(500, "Message cannot exceed 500 characters")
			.nullable()
			.optional(),
	})
	.strict()
	.default({});

export const sessionRequestParamsSchema = z
	.object({
		sessionId: z.uuid(),
		requestId: z.uuid(),
	})
	.strict();

export type CreateSessionRequestBody = z.infer<
	typeof createSessionRequestSchema
>;
