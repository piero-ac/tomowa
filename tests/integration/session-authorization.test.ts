import { eq } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import { sessions } from "../../src/db/schema.js";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { getAccessToken } from "../helpers/auth.js";

let ownerToken: string;
let otherToken: string;
let sessionId: string;

beforeAll(async () => {
	[ownerToken, otherToken] = await Promise.all([
		getAccessToken("requester@example.test"),
		getAccessToken("other@example.test"),
	]);

	const response = await request(app)
		.post("/api/sessions")
		.set("Authorization", `Bearer ${ownerToken}`)
		.send({
			title: "Authorization Test",
			targetLanguage: "Japanese",
			helpLanguage: "English",
			startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
			durationMinutes: 30,
			meetingLink: "https://example.test/authorization",
			description: "Temporary integration-test session.",
		});

	if (response.status !== 201 || !response.body.sessionId) {
		throw new Error(`Test session creation failed: ${response.status}`);
	}

	sessionId = response.body.sessionId;
});

afterAll(async () => {
	if (sessionId) {
		await request(app)
			.delete(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`);
	}
});

describe("session ownership", () => {
	it("prevents an unrelated user from updating the session", async () => {
		const response = await request(app)
			.patch(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${otherToken}`)
			.send({
				title: "Unauthorized Update",
			});

		expect(response.status).toBe(403);
	});

	it("allows the owner to update the session", async () => {
		const response = await request(app)
			.patch(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				title: "Updated by Owner",
			});

		expect(response.status).toBe(200);
		expect(response.body.title).toBe("Updated by Owner");
	});

	it("prevents an owner from creating two active sessions at the same start time", async () => {
		const existingSessionResponse = await request(app)
			.get(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(existingSessionResponse.status).toBe(200);

		const duplicateResponse = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				title: "Duplicate Start Time",
				targetLanguage: "Spanish",
				helpLanguage: "English",
				startsAt: existingSessionResponse.body.startsAt,
				durationMinutes: 30,
				meetingLink: "https://example.test/duplicate-time",
				description: "This start time is already occupied.",
			});

		expect(duplicateResponse.status).toBe(409);
		expect(duplicateResponse.body).toEqual({
			message: "You already have an active session at this start time.",
		});
	});

	it("permanently deletes an unused open session", async () => {
		const response = await request(app)
			.delete(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(204);

		const [storedSession] = await db
			.select({
				id: sessions.id,
			})
			.from(sessions)
			.where(eq(sessions.id, sessionId));

		expect(storedSession).toBeUndefined();

		sessionId = "";
	});
});
