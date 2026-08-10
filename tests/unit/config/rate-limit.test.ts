import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApiRateLimiter } from "../../../src/config/rate-limit.js";

function createTestApp() {
	const app = express();

	app.use(
		"/api",
		createApiRateLimiter({
			windowMs: 60_000,
			limit: 2,
		}),
	);
	app.get("/api/resource", (req, res) => {
		res.status(200).json({ status: "ok" });
	});
	app.get("/health", (req, res) => {
		res.status(200).json({ status: "ok" });
	});

	return app;
}

describe("API rate limiter", () => {
	it("returns 429 after a client exceeds the configured limit", async () => {
		const app = createTestApp();

		const firstResponse = await request(app).get("/api/resource");
		const secondResponse = await request(app).get("/api/resource");
		const blockedResponse = await request(app).get("/api/resource");

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);
		expect(blockedResponse.status).toBe(429);
		expect(blockedResponse.body).toEqual({
			message: "Too many requests. Please try again later.",
		});
		expect(blockedResponse.headers.ratelimit).toBeDefined();
		expect(blockedResponse.headers["ratelimit-policy"]).toBeDefined();
		expect(blockedResponse.headers["x-ratelimit-limit"]).toBeUndefined();
	});

	it("does not rate-limit routes outside the API", async () => {
		const app = createTestApp();

		const response = await request(app).get("/health");

		expect(response.status).toBe(200);
		expect(response.headers.ratelimit).toBeUndefined();
		expect(response.headers["ratelimit-policy"]).toBeUndefined();
	});
});
