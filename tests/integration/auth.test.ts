import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("API authentication", () => {
	it("rejects a request without an authorization header", async () => {
		const response = await request(app).get("/api/sessions");

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			message: "Authentication required.",
		});
	});

	it("rejects a malformed authorization header", async () => {
		const response = await request(app)
			.get("/api/sessions")
			.set("Authorization", "NotBearer token");

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			message: "Authentication required.",
		});
	});

	it("rejects an invalid access token", async () => {
		const response = await request(app)
			.get("/api/sessions")
			.set("Authorization", "Bearer invalid-token");

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			message: "Authentication required.",
		});
	});
});
