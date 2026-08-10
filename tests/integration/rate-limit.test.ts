import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";

describe("request infrastructure", () => {
	it("uses the configured proxy-hop count", () => {
		expect(app.get("trust proxy")).toBe(env.TRUST_PROXY_HOPS);
	});

	it("applies rate-limit headers to API routes", async () => {
		const response = await request(app).get("/api/sessions");

		expect(response.status).toBe(401);
		expect(response.headers.ratelimit).toBeDefined();
		expect(response.headers["ratelimit-policy"]).toBeDefined();
	});

	it("does not apply rate limiting to the health endpoint", async () => {
		const response = await request(app).get("/health");

		expect(response.status).toBe(200);
		expect(response.headers.ratelimit).toBeUndefined();
		expect(response.headers["ratelimit-policy"]).toBeUndefined();
	});
});
