import { z } from "zod";

export const paginationQuerySchema = z
	.object({
		limit: z.coerce
			.number()
			.int("Limit must be an integer")
			.min(1, "Limit must be at least 1")
			.max(50, "Limit cannot exceed 50")
			.default(20),

		cursor: z
			.string()
			.trim()
			.min(1, "Cursor cannot be empty")
			.max(500, "Cursor is too long")
			.optional(),
	})
	.strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
