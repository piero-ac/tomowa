import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { sessionRequests, sessions } from "../../src/db/schema.js";
import { getAccessToken } from "../helpers/auth.js";

const missingSessionId = "00000000-0000-4000-8000-000000000099";

let ownerToken: string;
let requesterToken: string;
let otherToken: string;
let sessionId: string;

beforeAll(async () => {
	[ownerToken, requesterToken, otherToken] = await Promise.all([
		getAccessToken("owner@example.test"),
		getAccessToken("requester@example.test"),
		getAccessToken("other@example.test"),
	]);

	const response = await request(app)
		.post("/api/sessions")
		.set("Authorization", `Bearer ${ownerToken}`)
		.send({
			title: "Request List Test",
			targetLanguage: "Japanese",
			helpLanguage: "English",
			startsAt: new Date(Date.now() + 50 * 86_400_000).toISOString(),
			durationMinutes: 30,
			meetingLink: "https://example.test/request-list",
			description: "Temporary request-list test.",
		});

	if (response.status !== 201 || !response.body.sessionId) {
		throw new Error(`Test session creation failed: ${response.status}`);
	}

	sessionId = response.body.sessionId;
});

afterAll(async () => {
	if (sessionId) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}
});

describe("GET /api/sessions/:sessionId/requests", () => {
	it("returns an empty list when the session has no requests", async () => {
		const response = await request(app)
			.get(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("prevents a non-owner from viewing the requests", async () => {
		const response = await request(app)
			.get(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`);

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			message: "Only the session owner can view its requests.",
		});
	});

	it("returns 404 when the session does not exist", async () => {
		const response = await request(app)
			.get(`/api/sessions/${missingSessionId}/requests`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			message: "Session not found.",
		});
	});

	it("returns the session requests from newest to oldest", async () => {
		const olderResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				message: "Older request.",
			});

		const newerResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${otherToken}`)
			.send({
				message: "Newer request.",
			});

		expect(olderResponse.status).toBe(201);
		expect(newerResponse.status).toBe(201);

		await db
			.update(sessionRequests)
			.set({
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			})
			.where(eq(sessionRequests.id, olderResponse.body.requestId));

		await db
			.update(sessionRequests)
			.set({
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
			})
			.where(eq(sessionRequests.id, newerResponse.body.requestId));

		const response = await request(app)
			.get(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(200);
		expect(response.body).toHaveLength(2);
		expect(
			response.body.map((item: { requestId: string }) => item.requestId),
		).toEqual([newerResponse.body.requestId, olderResponse.body.requestId]);

		expect(response.body[0].requester).toEqual({
			userId: response.body[0].requesterId,
			displayName: "Other User",
			username: null,
			avatarKey: null,
			nativeLanguage: null,
			learningLanguage: null,
		});

		expect(response.body[1].requester).toEqual({
			userId: response.body[1].requesterId,
			displayName: "Session Requester",
			username: null,
			avatarKey: null,
			nativeLanguage: null,
			learningLanguage: null,
		});

		for (const item of response.body) {
			expect(item.requester).not.toHaveProperty("bio");
			expect(item.requester).not.toHaveProperty("timezone");
			expect(item.requester).not.toHaveProperty("createdAt");
		}
	});
});
