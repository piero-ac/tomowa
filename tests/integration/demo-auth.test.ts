import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { getAccessToken } from "../helpers/auth.js";

const demoAccounts = [
	{
		role: "owner",
		email: "owner@example.test",
	},
	{
		role: "requester",
		email: "requester@example.test",
	},
	{
		role: "other",
		email: "other@example.test",
	},
] as const;

describe("POST /api/demo/login", () => {
	it.each(demoAccounts)(
		"returns a working token for the $role demo account",
		async ({ role, email }) => {
			const response = await request(app)
				.post("/api/demo/login")
				.send({ role });

			expect(response.status).toBe(200);
			expect(response.headers["cache-control"]).toBe("no-store");
			expect(response.body).toEqual({
				role,
				accessToken: expect.any(String),
				expiresAt: expect.any(Number),
			});
			expect(response.body.expiresAt).toBeGreaterThan(
				Math.floor(Date.now() / 1000),
			);
			expect(response.body).not.toHaveProperty("password");
			expect(response.body).not.toHaveProperty("refreshToken");
			expect(response.body).not.toHaveProperty("email");

			const expectedToken = await getAccessToken(email);
			const [demoProfileResponse, expectedProfileResponse] = await Promise.all([
				request(app)
					.get("/api/me/profile")
					.set("Authorization", `Bearer ${response.body.accessToken}`),
				request(app)
					.get("/api/me/profile")
					.set("Authorization", `Bearer ${expectedToken}`),
			]);

			expect(demoProfileResponse.status).toBe(200);
			expect(expectedProfileResponse.status).toBe(200);
			expect(demoProfileResponse.body.userId).toBe(
				expectedProfileResponse.body.userId,
			);
		},
	);

	it.each([
		{ role: "admin" },
		{ role: "owner", password: "client-supplied-password" },
		{},
	])("rejects the invalid body %o", async (body) => {
		const response = await request(app).post("/api/demo/login").send(body);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation failed.");
		expect(response.body).not.toHaveProperty("accessToken");
	});
});
