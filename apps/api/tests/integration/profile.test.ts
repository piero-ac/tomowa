import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { profiles } from "../../src/db/schema.js";
import { getAccessToken } from "../helpers/auth.js";

let ownerToken: string;
let requesterToken: string;
let ownerUserId: string;
let requesterUserId: string;

beforeAll(async () => {
	[ownerToken, requesterToken] = await Promise.all([
		getAccessToken("owner@example.test"),
		getAccessToken("requester@example.test"),
	]);

	const [ownerResponse, requesterResponse] = await Promise.all([
		request(app)
			.get("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`),
		request(app)
			.get("/api/me/profile")
			.set("Authorization", `Bearer ${requesterToken}`),
	]);

	if (ownerResponse.status !== 200 || requesterResponse.status !== 200) {
		throw new Error("Seeded profiles could not be loaded.");
	}

	ownerUserId = ownerResponse.body.userId;
	requesterUserId = requesterResponse.body.userId;
});

afterAll(async () => {
	await Promise.all([
		db
			.update(profiles)
			.set({
				displayName: "Session Owner",
				username: null,
				bio: null,
				nativeLanguage: null,
				learningLanguage: null,
				timezone: null,
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, ownerUserId)),
		db
			.update(profiles)
			.set({
				displayName: "Session Requester",
				username: null,
				bio: null,
				nativeLanguage: null,
				learningLanguage: null,
				timezone: null,
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, requesterUserId)),
	]);
});

describe("/api/me/profile", () => {
	it("returns the authenticated user's application profile", async () => {
		const response = await request(app)
			.get("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			userId: ownerUserId,
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

	it("updates allowed fields and normalizes the username", async () => {
		const response = await request(app)
			.patch("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				displayName: "Piero",
				username: "PIERO_123",
				bio: "Learning Japanese.",
				nativeLanguage: "English",
				learningLanguage: "Japanese",
				timezone: "America/New_York",
			});

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			userId: ownerUserId,
			displayName: "Piero",
			username: "piero_123",
			bio: "Learning Japanese.",
			nativeLanguage: "English",
			learningLanguage: "Japanese",
			timezone: "America/New_York",
		});
	});

	it("allows nullable fields to be cleared", async () => {
		const response = await request(app)
			.patch("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				bio: null,
				timezone: null,
			});

		expect(response.status).toBe(200);
		expect(response.body.bio).toBeNull();
		expect(response.body.timezone).toBeNull();
	});

	it("rejects server-controlled and unsupported fields", async () => {
		const response = await request(app)
			.patch("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				userId: requesterUserId,
				avatarKey: "profile-images/unauthorized.png",
			});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation failed.");
	});

	it("rejects an invalid timezone", async () => {
		const response = await request(app)
			.patch("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				timezone: "Not/A_Timezone",
			});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation failed.");
	});

	it("rejects an empty update", async () => {
		const response = await request(app)
			.patch("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation failed.");
	});

	it("returns 409 when the normalized username is already used", async () => {
		const requesterResponse = await request(app)
			.patch("/api/me/profile")
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				username: "taken_name",
			});

		expect(requesterResponse.status).toBe(200);

		const ownerResponse = await request(app)
			.patch("/api/me/profile")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				username: "TAKEN_NAME",
			});

		expect(ownerResponse.status).toBe(409);
		expect(ownerResponse.body).toEqual({
			message: "Username is already in use.",
		});
	});
});
