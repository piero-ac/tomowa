import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { sessionRequests, sessions } from "../../src/db/schema.js";
import { getAccessToken } from "../helpers/auth.js";

let ownerToken: string;
let requesterToken: string;
let otherToken: string;

const createdSessionIds: string[] = [];

beforeAll(async () => {
	[ownerToken, requesterToken, otherToken] = await Promise.all([
		getAccessToken("owner@example.test"),
		getAccessToken("requester@example.test"),
		getAccessToken("other@example.test"),
	]);
});

afterAll(async () => {
	if (createdSessionIds.length > 0) {
		await db.delete(sessions).where(inArray(sessions.id, createdSessionIds));
	}
});

async function createTestSession(
	title: string,
	startsInDays: number,
	meetingLink: string,
) {
	const response = await request(app)
		.post("/api/sessions")
		.set("Authorization", `Bearer ${ownerToken}`)
		.send({
			title,
			targetLanguage: "Japanese",
			helpLanguage: "English",
			startsAt: new Date(Date.now() + startsInDays * 86_400_000).toISOString(),
			durationMinutes: 30,
			meetingLink,
			description: "Temporary requester-dashboard test.",
		});

	if (response.status !== 201 || !response.body.sessionId) {
		throw new Error(`Test session creation failed: ${response.status}`);
	}

	createdSessionIds.push(response.body.sessionId);

	return response.body.sessionId as string;
}

describe("GET /api/me/session-requests", () => {
	it("returns an empty list when the user has made no requests", async () => {
		const response = await request(app)
			.get("/api/me/session-requests")
			.set("Authorization", `Bearer ${otherToken}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("returns only the user's requests with session details and correct privacy", async () => {
		const firstSessionId = await createTestSession(
			"Request History Session",
			70,
			"https://example.test/history",
		);

		const approvedSessionId = await createTestSession(
			"Approved Request Session",
			71,
			"https://example.test/approved",
		);

		const pendingSessionId = await createTestSession(
			"Pending Request Session",
			72,
			"https://example.test/pending",
		);

		const cancelledResponse = await request(app)
			.post(`/api/sessions/${firstSessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({ message: "Cancelled request." });

		expect(cancelledResponse.status).toBe(201);

		await request(app)
			.post(
				`/api/sessions/${firstSessionId}/requests/${cancelledResponse.body.requestId}/cancel`,
			)
			.set("Authorization", `Bearer ${requesterToken}`)
			.expect(200);

		const declinedResponse = await request(app)
			.post(`/api/sessions/${firstSessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({ message: "Declined request." });

		expect(declinedResponse.status).toBe(201);

		await request(app)
			.post(
				`/api/sessions/${firstSessionId}/requests/${declinedResponse.body.requestId}/decline`,
			)
			.set("Authorization", `Bearer ${ownerToken}`)
			.expect(200);

		const approvedResponse = await request(app)
			.post(`/api/sessions/${approvedSessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({ message: "Approved request." });

		expect(approvedResponse.status).toBe(201);

		await request(app)
			.post(
				`/api/sessions/${approvedSessionId}/requests/${approvedResponse.body.requestId}/approve`,
			)
			.set("Authorization", `Bearer ${ownerToken}`)
			.expect(200);

		const pendingResponse = await request(app)
			.post(`/api/sessions/${pendingSessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({ message: "Pending request." });

		expect(pendingResponse.status).toBe(201);

		await request(app)
			.post(`/api/sessions/${pendingSessionId}/requests`)
			.set("Authorization", `Bearer ${otherToken}`)
			.send({ message: "Another user's request." })
			.expect(201);

		const orderedRequests = [
			cancelledResponse.body.requestId,
			declinedResponse.body.requestId,
			approvedResponse.body.requestId,
			pendingResponse.body.requestId,
		];

		for (const [index, requestId] of orderedRequests.entries()) {
			await db
				.update(sessionRequests)
				.set({
					createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
				})
				.where(eq(sessionRequests.id, requestId));
		}

		const response = await request(app)
			.get("/api/me/session-requests")
			.set("Authorization", `Bearer ${requesterToken}`);

		expect(response.status).toBe(200);
		expect(response.body).toHaveLength(4);

		expect(
			response.body.map((item: { requestId: string }) => item.requestId),
		).toEqual([
			pendingResponse.body.requestId,
			approvedResponse.body.requestId,
			declinedResponse.body.requestId,
			cancelledResponse.body.requestId,
		]);

		const pendingRequest = response.body[0];
		const approvedRequest = response.body[1];
		const declinedRequest = response.body[2];
		const cancelledRequest = response.body[3];

		expect(pendingRequest).toMatchObject({
			status: "pending",
			session: {
				sessionId: pendingSessionId,
				title: "Pending Request Session",
			},
		});
		expect(pendingRequest.session).not.toHaveProperty("meetingLink");

		expect(approvedRequest).toMatchObject({
			status: "approved",
			session: {
				sessionId: approvedSessionId,
				title: "Approved Request Session",
				meetingLink: "https://example.test/approved",
			},
		});

		expect(declinedRequest.status).toBe("declined");
		expect(declinedRequest.session).not.toHaveProperty("meetingLink");

		expect(cancelledRequest.status).toBe("cancelled");
		expect(cancelledRequest.session).not.toHaveProperty("meetingLink");

		for (const requestItem of response.body) {
			expect(requestItem.session.owner).toEqual({
				userId: requestItem.session.ownerId,
				displayName: "Session Owner",
				username: null,
				avatarKey: null,
				nativeLanguage: null,
				learningLanguage: null,
			});

			expect(requestItem.session.owner).not.toHaveProperty("bio");
			expect(requestItem.session.owner).not.toHaveProperty("timezone");
			expect(requestItem.session.owner).not.toHaveProperty("createdAt");
		}
	});
});
