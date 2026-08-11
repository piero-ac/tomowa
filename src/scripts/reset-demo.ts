import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import { demoResetEnvSchema } from "../config/demo-reset.js";
import { resetDemoData } from "../demo/reset-demo-data.js";

const configResult = demoResetEnvSchema.safeParse(process.env);

if (!configResult.success) {
	console.error(
		"Invalid demo reset configuration:",
		z.flattenError(configResult.error),
	);
	process.exitCode = 1;
} else {
	const config = configResult.data;
	const databaseClient = postgres(config.DATABASE_URL, {
		max: 1,
		prepare: false,
	});
	const database = drizzle({ client: databaseClient });

	try {
		const result = await resetDemoData(database);

		console.log(`Demo data reset completed for ${config.DEMO_RESET_TARGET}.`);
		console.log(`Profiles updated: ${result.profilesUpdated}`);
		console.log(`Sessions deleted: ${result.sessionsDeleted}`);
		console.log(`Requests deleted: ${result.requestsDeleted}`);
		console.log(`Sessions created: ${result.sessionsCreated}`);
		console.log(`Requests created: ${result.requestsCreated}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error.";

		console.error(`Demo data reset failed: ${message}`);
		process.exitCode = 1;
	} finally {
		await databaseClient.end();
	}
}
