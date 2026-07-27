import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { sessions } from "../../src/db/schema.js";
import { getAccessToken } from "../helpers/auth.js";

let ownerToken: string;
let approvedRequesterToken: string;
let unrelatedToken: string;

const createdSessionIds: string[] = [];

beforeAll(async () => {
	[ownerToken, approvedRequesterToken, unrelatedToken] = await Promise.all([
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
			description: "Temporary booked-session test.",
		});

	if (response.status !== 201 || !response.body.sessionId) {
		throw new Error(`Test session creation failed: ${response.status}`);
	}

	createdSessionIds.push(response.body.sessionId);

	return response.body.sessionId as string;
}

async function bookSession(sessionId: string) {
	const requestResponse = await request(app)
		.post(`/api/sessions/${sessionId}/requests`)
		.set("Authorization", `Bearer ${approvedRequesterToken}`)
		.send({
			message: "Please book this session.",
		});

	expect(requestResponse.status).toBe(201);

	await request(app)
		.post(
			`/api/sessions/${sessionId}/requests/${requestResponse.body.requestId}/approve`,
		)
		.set("Authorization", `Bearer ${ownerToken}`)
		.expect(200);
}

describe("GET /api/me/sessions-booked", () => {
	it("returns an empty list when the user has no booked sessions", async () => {
		const response = await request(app)
			.get("/api/me/sessions-booked")
			.set("Authorization", `Bearer ${unrelatedToken}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("returns future booked sessions to owners and approved requesters", async () => {
		const nearestSessionId = await createTestSession(
			"Nearest Booked Session",
			80,
			"https://example.test/nearest-booked",
		);

		const laterSessionId = await createTestSession(
			"Later Booked Session",
			81,
			"https://example.test/later-booked",
		);

		const openSessionId = await createTestSession(
			"Open Session",
			79,
			"https://example.test/open-session",
		);

		const pastSessionId = await createTestSession(
			"Past Booked Session",
			82,
			"https://example.test/past-booked",
		);

		await bookSession(nearestSessionId);
		await bookSession(laterSessionId);
		await bookSession(pastSessionId);

		await db
			.update(sessions)
			.set({
				startsAt: new Date(Date.now() - 60_000),
			})
			.where(eq(sessions.id, pastSessionId));

		const ownerResponse = await request(app)
			.get("/api/me/sessions-booked")
			.set("Authorization", `Bearer ${ownerToken}`);

		const requesterResponse = await request(app)
			.get("/api/me/sessions-booked")
			.set("Authorization", `Bearer ${approvedRequesterToken}`);

		const unrelatedResponse = await request(app)
			.get("/api/me/sessions-booked")
			.set("Authorization", `Bearer ${unrelatedToken}`);

		expect(ownerResponse.status).toBe(200);
		expect(requesterResponse.status).toBe(200);
		expect(unrelatedResponse.status).toBe(200);

		for (const response of [ownerResponse, requesterResponse]) {
			expect(response.body).toHaveLength(2);

			expect(
				response.body.map(
					(session: { sessionId: string }) => session.sessionId,
				),
			).toEqual([nearestSessionId, laterSessionId]);

			expect(response.body[0]).toMatchObject({
				sessionId: nearestSessionId,
				status: "booked",
				meetingLink: "https://example.test/nearest-booked",
			});

			expect(response.body[1]).toMatchObject({
				sessionId: laterSessionId,
				status: "booked",
				meetingLink: "https://example.test/later-booked",
			});
		}

		expect(unrelatedResponse.body).toEqual([]);

		expect(
			ownerResponse.body.some(
				(session: { sessionId: string }) =>
					session.sessionId === openSessionId ||
					session.sessionId === pastSessionId,
			),
		).toBe(false);
	});
});
