import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().int().min(1).max(65535).default(3001),
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
