import { inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { sessions } from "../../src/db/schema.js";
import { getAccessToken } from "../helpers/auth.js";

let dashboardOwnerToken: string;
let firstRequesterToken: string;
let secondRequesterToken: string;

const createdSessionIds: string[] = [];

beforeAll(async () => {
	[dashboardOwnerToken, firstRequesterToken, secondRequesterToken] =
		await Promise.all([
			getAccessToken("other@example.test"),
			getAccessToken("owner@example.test"),
			getAccessToken("requester@example.test"),
		]);
});

afterAll(async () => {
	if (createdSessionIds.length > 0) {
		await db.delete(sessions).where(inArray(sessions.id, createdSessionIds));
	}
});

describe("GET /api/me/sessions-created", () => {
	it("returns an empty list when the user has not created sessions", async () => {
		const response = await request(app)
			.get("/api/me/sessions-created")
			.set("Authorization", `Bearer ${dashboardOwnerToken}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			items: [],
			nextCursor: null,
		});
	});

	it("returns owned sessions with meeting links and request summaries", async () => {
		const firstSessionResponse = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${dashboardOwnerToken}`)
			.send({
				title: "First Owned Session",
				targetLanguage: "Japanese",
				helpLanguage: "English",
				startsAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
				durationMinutes: 30,
				meetingLink: "https://example.test/first-owned",
				description: "First owned-session test.",
			});

		const secondSessionResponse = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${dashboardOwnerToken}`)
			.send({
				title: "Second Owned Session",
				targetLanguage: "Spanish",
				helpLanguage: "English",
				startsAt: new Date(Date.now() + 61 * 86_400_000).toISOString(),
				durationMinutes: 45,
				meetingLink: "https://example.test/second-owned",
				description: "Second owned-session test.",
			});

		expect(firstSessionResponse.status).toBe(201);
		expect(secondSessionResponse.status).toBe(201);

		const firstSessionId = firstSessionResponse.body.sessionId;
		const secondSessionId = secondSessionResponse.body.sessionId;

		createdSessionIds.push(firstSessionId, secondSessionId);

		const cancelledRequestResponse = await request(app)
			.post(`/api/sessions/${firstSessionId}/requests`)
			.set("Authorization", `Bearer ${firstRequesterToken}`)
			.send({ message: "Request that will be cancelled." });

		expect(cancelledRequestResponse.status).toBe(201);

		await request(app)
			.post(
				`/api/sessions/${firstSessionId}/requests/${cancelledRequestResponse.body.requestId}/cancel`,
			)
			.set("Authorization", `Bearer ${firstRequesterToken}`)
			.expect(200);

		const declinedRequestResponse = await request(app)
			.post(`/api/sessions/${firstSessionId}/requests`)
			.set("Authorization", `Bearer ${firstRequesterToken}`)
			.send({ message: "Request that will be declined." });

		expect(declinedRequestResponse.status).toBe(201);

		await request(app)
			.post(
				`/api/sessions/${firstSessionId}/requests/${declinedRequestResponse.body.requestId}/decline`,
			)
			.set("Authorization", `Bearer ${dashboardOwnerToken}`)
			.expect(200);

		const automaticallyDeclinedResponse = await request(app)
			.post(`/api/sessions/${firstSessionId}/requests`)
			.set("Authorization", `Bearer ${firstRequesterToken}`)
			.send({ message: "Request declined during approval." });

		const approvedRequestResponse = await request(app)
			.post(`/api/sessions/${firstSessionId}/requests`)
			.set("Authorization", `Bearer ${secondRequesterToken}`)
			.send({ message: "Request that will be approved." });

		expect(automaticallyDeclinedResponse.status).toBe(201);
		expect(approvedRequestResponse.status).toBe(201);

		await request(app)
			.post(
				`/api/sessions/${firstSessionId}/requests/${approvedRequestResponse.body.requestId}/approve`,
			)
			.set("Authorization", `Bearer ${dashboardOwnerToken}`)
			.expect(200);

		await request(app)
			.post(`/api/sessions/${secondSessionId}/requests`)
			.set("Authorization", `Bearer ${firstRequesterToken}`)
			.send({ message: "Pending request." })
			.expect(201);

		const response = await request(app)
			.get("/api/me/sessions-created")
			.set("Authorization", `Bearer ${dashboardOwnerToken}`);

		expect(response.status).toBe(200);
		expect(response.body.items).toHaveLength(2);
		expect(response.body.nextCursor).toBeNull();

		expect(response.body.items[0]).toMatchObject({
			sessionId: secondSessionId,
			meetingLink: "https://example.test/second-owned",
			requestSummary: {
				pending: 1,
				approved: 0,
				declined: 0,
				cancelled: 0,
				total: 1,
			},
		});

		expect(response.body.items[1]).toMatchObject({
			sessionId: firstSessionId,
			meetingLink: "https://example.test/first-owned",
			requestSummary: {
				pending: 0,
				approved: 1,
				declined: 2,
				cancelled: 1,
				total: 4,
			},
		});

		for (const session of response.body.items) {
			expect(session.owner).toEqual({
				userId: session.ownerId,
				displayName: "Other User",
				username: null,
				avatarKey: null,
				nativeLanguage: null,
				learningLanguage: null,
			});

			expect(session.owner).not.toHaveProperty("bio");
			expect(session.owner).not.toHaveProperty("timezone");
			expect(session.owner).not.toHaveProperty("createdAt");
		}

		const firstPage = await request(app)
			.get("/api/me/sessions-created")
			.query({ limit: 1 })
			.set("Authorization", `Bearer ${dashboardOwnerToken}`);

		expect(firstPage.status).toBe(200);
		expect(firstPage.body.items).toHaveLength(1);
		expect(firstPage.body.items[0].sessionId).toBe(secondSessionId);
		expect(firstPage.body.nextCursor).toEqual(expect.any(String));

		const secondPage = await request(app)
			.get("/api/me/sessions-created")
			.query({
				limit: 1,
				cursor: firstPage.body.nextCursor,
			})
			.set("Authorization", `Bearer ${dashboardOwnerToken}`);

		expect(secondPage.status).toBe(200);
		expect(secondPage.body.items).toHaveLength(1);
		expect(secondPage.body.items[0].sessionId).toBe(firstSessionId);
		expect(secondPage.body.nextCursor).toBeNull();
	});
});
