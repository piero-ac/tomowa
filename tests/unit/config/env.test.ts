import { describe, expect, it } from "vitest";

import { envSchema } from "../../../src/config/env.js";

const requiredEnvironment = {
	DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
	SUPABASE_URL: "http://127.0.0.1:54321",
	SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
};

describe("demo access environment configuration", () => {
	it("defaults demo access to disabled without requiring passwords", () => {
		const result = envSchema.parse(requiredEnvironment);

		expect(result.DEMO_ACCESS_ENABLED).toBe(false);
		expect(result.DEMO_OWNER_PASSWORD).toBeUndefined();
		expect(result.DEMO_REQUESTER_PASSWORD).toBeUndefined();
		expect(result.DEMO_OTHER_PASSWORD).toBeUndefined();
	});

	it("rejects enabled demo access when any account password is missing", () => {
		const result = envSchema.safeParse({
			...requiredEnvironment,
			DEMO_ACCESS_ENABLED: "true",
			DEMO_OWNER_PASSWORD: "owner-password",
			DEMO_REQUESTER_PASSWORD: "requester-password",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["DEMO_OTHER_PASSWORD"],
					}),
				]),
			);
		}
	});

	it("accepts enabled demo access with all account passwords", () => {
		const result = envSchema.parse({
			...requiredEnvironment,
			DEMO_ACCESS_ENABLED: "true",
			DEMO_OWNER_PASSWORD: "owner-password",
			DEMO_REQUESTER_PASSWORD: "requester-password",
			DEMO_OTHER_PASSWORD: "other-password",
		});

		expect(result).toMatchObject({
			DEMO_ACCESS_ENABLED: true,
			DEMO_OWNER_PASSWORD: "owner-password",
			DEMO_REQUESTER_PASSWORD: "requester-password",
			DEMO_OTHER_PASSWORD: "other-password",
		});
	});

	it("does not treat the string false as enabled", () => {
		const result = envSchema.parse({
			...requiredEnvironment,
			DEMO_ACCESS_ENABLED: "false",
		});

		expect(result.DEMO_ACCESS_ENABLED).toBe(false);
	});
});
