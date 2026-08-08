import { z } from "zod";

const nullableText = (maximum: number) =>
	z
		.string()
		.trim()
		.min(1, "Value cannot be empty")
		.max(maximum)
		.nullable()
		.optional();

const timezoneSchema = z
	.string()
	.trim()
	.refine((value) => {
		try {
			new Intl.DateTimeFormat("en-US", {
				timeZone: value,
			});

			return true;
		} catch {
			return false;
		}
	}, "Timezone must be a valid IANA timezone")
	.nullable()
	.optional();

export const updateProfileSchema = z
	.object({
		displayName: nullableText(80),

		username: z
			.string()
			.trim()
			.toLowerCase()
			.min(3, "Username must be at least 3 characters")
			.max(30, "Username cannot exceed 30 characters")
			.regex(
				/^[a-z0-9_]+$/,
				"Username may contain only lowercase letters, numbers, and underscores",
			)
			.nullable()
			.optional(),

		bio: nullableText(500),

		nativeLanguage: nullableText(50),

		learningLanguage: nullableText(50),

		timezone: timezoneSchema,
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
