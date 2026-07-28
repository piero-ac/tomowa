import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { getAccessToken } from "../helpers/auth.js";

let ownerToken: string;

beforeAll(async () => {
	ownerToken = await getAccessToken("owner@example.test");
});

describe("GET /api/me/profile", () => {
	it("returns the authenticated user's application profile", async () => {
		const response = await request(app)
			.get("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(200);

		expect(response.body).toEqual({
			userId: expect.any(String),
			displayName: "Session Owner",
			username: null,
			bio: null,
			avatarKey: null,
			nativeLanguage: null,
			learningLanguage: null,
			timezone: null,
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		});

		expect(response.body).not.toHaveProperty("email");
		expect(response.body).not.toHaveProperty("password");
	});
});
