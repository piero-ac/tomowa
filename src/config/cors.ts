import type { CorsOptions } from "cors";
import { z } from "zod";

const corsOriginSchema = z
	.url()
	.refine((value) => new URL(value).origin === value, {
		message: "CORS origins must not include a path or trailing slash",
	});

export const corsAllowedOriginsSchema = z
	.string()
	.default("")
	.transform((value) =>
		value
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean),
	)
	.pipe(z.array(corsOriginSchema));

export function createCorsOptions(
	allowedOrigins: readonly string[],
): CorsOptions {
	return {
		origin(origin, callback) {
			if (origin === undefined || allowedOrigins.includes(origin)) {
				callback(null, true);
				return;
			}

			callback(null, false);
		},
	};
}
