import { z } from "zod";

import { corsAllowedOriginsSchema } from "./cors.js";

const booleanString = z
	.enum(["true", "false"])
	.default("false")
	.transform((value) => value === "true");

const optionalSecret = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() === "" ? undefined : value,
	z.string().min(1).optional(),
);

export const envSchema = z
	.object({
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		PORT: z.coerce.number().int().min(1).max(65535).default(3001),
		CORS_ALLOWED_ORIGINS: corsAllowedOriginsSchema,
		TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
		RATE_LIMIT_WINDOW_MS: z.coerce
			.number()
			.int()
			.min(1_000)
			.max(86_400_000)
			.default(60_000),
		RATE_LIMIT_MAX_REQUESTS: z.coerce
			.number()
			.int()
			.min(1)
			.max(10_000)
			.default(300),
		DEMO_ACCESS_ENABLED: booleanString,
		DEMO_OWNER_PASSWORD: optionalSecret,
		DEMO_REQUESTER_PASSWORD: optionalSecret,
		DEMO_OTHER_PASSWORD: optionalSecret,
		DATABASE_URL: z.url(),
		SUPABASE_URL: z.url(),
		SUPABASE_PUBLISHABLE_KEY: z
			.string()
			.trim()
			.min(1, "SUPABASE_PUBLISHABLE_KEY is required"),
	})
	.superRefine((value, context) => {
		if (!value.DEMO_ACCESS_ENABLED) {
			return;
		}

		const requiredDemoSecrets = [
			"DEMO_OWNER_PASSWORD",
			"DEMO_REQUESTER_PASSWORD",
			"DEMO_OTHER_PASSWORD",
		] as const;

		for (const secretName of requiredDemoSecrets) {
			if (!value[secretName]) {
				context.addIssue({
					code: "custom",
					path: [secretName],
					message: `${secretName} is required when demo access is enabled`,
				});
			}
		}
	});
