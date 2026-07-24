import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { sessionRequests, sessions } from "../../src/db/schema.js";
import { getAccessToken } from "../helpers/auth.js";

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

	const sessionResponse = await request(app)
		.post("/api/sessions")
		.set("Authorization", `Bearer ${ownerToken}`)
		.send({
			title: "Concurrent Approval Test",
			targetLanguage: "Japanese",
			helpLanguage: "English",
			startsAt: new Date(Date.now() + 40 * 86_400_000).toISOString(),
			durationMinutes: 30,
			meetingLink: "https://example.test/concurrency",
			description: "Temporary concurrency test.",
		});

	if (sessionResponse.status !== 201 || !sessionResponse.body.sessionId) {
		throw new Error(`Test session creation failed: ${sessionResponse.status}`);
	}

	sessionId = sessionResponse.body.sessionId;
});

afterAll(async () => {
	if (sessionId) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}
});

describe("concurrent booking operations", () => {
	it("allows only one of two simultaneous approvals to succeed", async () => {
		const [firstRequestResponse, secondRequestResponse] = await Promise.all([
			request(app)
				.post(`/api/sessions/${sessionId}/requests`)
				.set("Authorization", `Bearer ${requesterToken}`)
				.send({ message: "First concurrent requester." }),
			request(app)
				.post(`/api/sessions/${sessionId}/requests`)
				.set("Authorization", `Bearer ${otherToken}`)
				.send({ message: "Second concurrent requester." }),
		]);

		expect(firstRequestResponse.status).toBe(201);
		expect(secondRequestResponse.status).toBe(201);

		const approvalResponses = await Promise.all([
			request(app)
				.post(
					`/api/sessions/${sessionId}/requests/${firstRequestResponse.body.requestId}/approve`,
				)
				.set("Authorization", `Bearer ${ownerToken}`),
			request(app)
				.post(
					`/api/sessions/${sessionId}/requests/${secondRequestResponse.body.requestId}/approve`,
				)
				.set("Authorization", `Bearer ${ownerToken}`),
		]);

		expect(approvalResponses.map((response) => response.status).sort()).toEqual(
			[200, 409],
		);

		const [storedSession] = await db
			.select({
				status: sessions.status,
			})
			.from(sessions)
			.where(eq(sessions.id, sessionId));

		const storedRequests = await db
			.select({
				status: sessionRequests.status,
			})
			.from(sessionRequests)
			.where(eq(sessionRequests.sessionId, sessionId));

		expect(storedSession?.status).toBe("booked");
		expect(storedRequests.map((row) => row.status).sort()).toEqual([
			"approved",
			"declined",
		]);
	});

	it("keeps a valid state when approval races against cancellation", async () => {
		const sessionResponse = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				title: "Approval Cancellation Race",
				targetLanguage: "Japanese",
				helpLanguage: "English",
				startsAt: new Date(Date.now() + 41 * 86_400_000).toISOString(),
				durationMinutes: 30,
				meetingLink: "https://example.test/approval-cancellation-race",
				description: "Temporary approval and cancellation race.",
			});

		expect(sessionResponse.status).toBe(201);

		const raceSessionId = sessionResponse.body.sessionId;

		try {
			const requestResponse = await request(app)
				.post(`/api/sessions/${raceSessionId}/requests`)
				.set("Authorization", `Bearer ${requesterToken}`)
				.send({
					message: "Approval cancellation race.",
				});

			expect(requestResponse.status).toBe(201);

			const requestId = requestResponse.body.requestId;

			const [approvalResponse, cancellationResponse] = await Promise.all([
				request(app)
					.post(`/api/sessions/${raceSessionId}/requests/${requestId}/approve`)
					.set("Authorization", `Bearer ${ownerToken}`),
				request(app)
					.post(`/api/sessions/${raceSessionId}/requests/${requestId}/cancel`)
					.set("Authorization", `Bearer ${requesterToken}`),
			]);

			const responseStatuses = [
				approvalResponse.status,
				cancellationResponse.status,
			].sort();

			expect([
				[200, 200],
				[200, 409],
			]).toContainEqual(responseStatuses);

			const [storedSession] = await db
				.select({
					status: sessions.status,
				})
				.from(sessions)
				.where(eq(sessions.id, raceSessionId));

			const [storedRequest] = await db
				.select({
					status: sessionRequests.status,
				})
				.from(sessionRequests)
				.where(eq(sessionRequests.id, requestId));

			expect([
				{
					sessionStatus: "booked",
					requestStatus: "approved",
				},
				{
					sessionStatus: "open",
					requestStatus: "cancelled",
				},
			]).toContainEqual({
				sessionStatus: storedSession?.status,
				requestStatus: storedRequest?.status,
			});
		} finally {
			await db.delete(sessions).where(eq(sessions.id, raceSessionId));
		}
	});

	it("keeps a valid state when request creation races against owner cancellation", async () => {
		const sessionResponse = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				title: "Request Creation Cancellation Race",
				targetLanguage: "Japanese",
				helpLanguage: "English",
				startsAt: new Date(Date.now() + 42 * 86_400_000).toISOString(),
				durationMinutes: 30,
				meetingLink: "https://example.test/creation-cancellation-race",
				description: "Temporary creation and cancellation race.",
			});

		expect(sessionResponse.status).toBe(201);

		const raceSessionId = sessionResponse.body.sessionId;

		try {
			const [creationResponse, deletionResponse] = await Promise.all([
				request(app)
					.post(`/api/sessions/${raceSessionId}/requests`)
					.set("Authorization", `Bearer ${requesterToken}`)
					.send({
						message: "Request creation cancellation race.",
					}),
				request(app)
					.delete(`/api/sessions/${raceSessionId}`)
					.set("Authorization", `Bearer ${ownerToken}`),
			]);

			expect([201, 404]).toContain(creationResponse.status);
			expect(deletionResponse.status).toBe(204);

			const [storedSession] = await db
				.select({
					status: sessions.status,
				})
				.from(sessions)
				.where(eq(sessions.id, raceSessionId));

			const storedRequests = await db
				.select({
					status: sessionRequests.status,
				})
				.from(sessionRequests)
				.where(eq(sessionRequests.sessionId, raceSessionId));

			if (creationResponse.status === 404) {
				expect(storedSession).toBeUndefined();
				expect(storedRequests).toHaveLength(0);
			} else {
				expect(storedSession?.status).toBe("cancelled");
				expect(storedRequests).toHaveLength(1);
				expect(storedRequests[0]?.status).toBe("cancelled");
			}
		} finally {
			await db.delete(sessions).where(eq(sessions.id, raceSessionId));
		}
	});
});
