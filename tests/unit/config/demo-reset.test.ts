import { describe, expect, it } from "vitest";

import {
	DEMO_RESET_CONFIRMATION,
	demoResetEnvSchema,
	parseDemoResetConfig,
} from "../../../src/config/demo-reset.js";

describe("demo reset configuration", () => {
	it("accepts an explicitly confirmed local database", () => {
		const config = parseDemoResetConfig({
			DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
			DEMO_RESET_TARGET: "local",
			DEMO_RESET_CONFIRMATION,
		});

		expect(config.DEMO_RESET_TARGET).toBe("local");
	});

	it("accepts an explicitly confirmed hosted database", () => {
		const config = parseDemoResetConfig({
			DATABASE_URL: "postgresql://postgres:password@db.example.test/postgres",
			DEMO_RESET_TARGET: "hosted",
			DEMO_RESET_CONFIRMATION,
		});

		expect(config.DEMO_RESET_TARGET).toBe("hosted");
	});

	it.each([
		{
			DATABASE_URL: "postgresql://postgres:password@db.example.test/postgres",
			DEMO_RESET_TARGET: "local",
			DEMO_RESET_CONFIRMATION,
		},
		{
			DATABASE_URL: "postgresql://postgres:postgres@localhost:54322/postgres",
			DEMO_RESET_TARGET: "hosted",
			DEMO_RESET_CONFIRMATION,
		},
	])("rejects a target that contradicts the database host", (environment) => {
		expect(demoResetEnvSchema.safeParse(environment).success).toBe(false);
	});

	it("rejects an incorrect confirmation phrase", () => {
		const result = demoResetEnvSchema.safeParse({
			DATABASE_URL: "postgresql://postgres:postgres@localhost:54322/postgres",
			DEMO_RESET_TARGET: "local",
			DEMO_RESET_CONFIRMATION: "yes",
		});

		expect(result.success).toBe(false);
	});

	it("rejects a non-PostgreSQL URL", () => {
		const result = demoResetEnvSchema.safeParse({
			DATABASE_URL: "https://database.example.test",
			DEMO_RESET_TARGET: "hosted",
			DEMO_RESET_CONFIRMATION,
		});

		expect(result.success).toBe(false);
	});
});
