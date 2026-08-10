import "dotenv/config";
import { z } from "zod";

import { corsAllowedOriginsSchema } from "./cors.js";

const envSchema = z.object({
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
	DATABASE_URL: z.url(),
	SUPABASE_URL: z.url(),
	SUPABASE_PUBLISHABLE_KEY: z
		.string()
		.trim()
		.min(1, "SUPABASE_PUBLISHABLE_KEY is required"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
	console.error(
		"Invalid environment configuration:",
		z.flattenError(result.error),
	);

	process.exit(1);
}

export const env = result.data;
