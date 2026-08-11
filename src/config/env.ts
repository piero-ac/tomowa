import "dotenv/config";
import { z } from "zod";

import { envSchema } from "./env.schema.js";

const result = envSchema.safeParse(process.env);

if (!result.success) {
	console.error(
		"Invalid environment configuration:",
		z.flattenError(result.error),
	);

	process.exit(1);
}

export const env = result.data;
