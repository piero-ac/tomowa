import { z } from "zod";

export const DEMO_RESET_CONFIRMATION = "RESET_TOMOWA_DEMO_DATA";

const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1"]);

export const demoResetEnvSchema = z
	.object({
		DATABASE_URL: z
			.url()
			.refine(
				(value) =>
					["postgres:", "postgresql:"].includes(new URL(value).protocol),
				"DATABASE_URL must use the postgres or postgresql protocol",
			),
		DEMO_RESET_TARGET: z.enum(["local", "hosted"]),
		DEMO_RESET_CONFIRMATION: z.literal(DEMO_RESET_CONFIRMATION),
	})
	.superRefine((value, context) => {
		const hostname = new URL(value.DATABASE_URL).hostname;
		const isLocalDatabase = localDatabaseHosts.has(hostname);

		if (value.DEMO_RESET_TARGET === "local" && !isLocalDatabase) {
			context.addIssue({
				code: "custom",
				path: ["DATABASE_URL"],
				message: "A local demo reset requires a localhost database URL",
			});
		}

		if (value.DEMO_RESET_TARGET === "hosted" && isLocalDatabase) {
			context.addIssue({
				code: "custom",
				path: ["DATABASE_URL"],
				message: "A hosted demo reset requires a non-local database URL",
			});
		}
	});

export type DemoResetConfig = z.infer<typeof demoResetEnvSchema>;

export function parseDemoResetConfig(
	environment: NodeJS.ProcessEnv,
): DemoResetConfig {
	return demoResetEnvSchema.parse(environment);
}
