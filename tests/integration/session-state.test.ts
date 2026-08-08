import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { sessions } from "../../src/db/schema.js";
import { getAccessToken } from "../helpers/auth.js";

let ownerToken: string;
let requesterToken: string;
let sessionId: string;

beforeAll(async () => {
	[ownerToken, requesterToken] = await Promise.all([
		getAccessToken("owner@example.test"),
		getAccessToken("requester@example.test"),
	]);

	const response = await request(app)
		.post("/api/sessions")
		.set("Authorization", `Bearer ${ownerToken}`)
		.send({
			title: "Past Session Test",
			targetLanguage: "Japanese",
			helpLanguage: "English",
			startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
			durationMinutes: 30,
			meetingLink: "https://example.test/past-session",
			description: "Temporary past-session test.",
		});

	if (response.status !== 201 || !response.body.sessionId) {
		throw new Error(`Test session creation failed: ${response.status}`);
	}

	sessionId = response.body.sessionId;

	await db
		.update(sessions)
		.set({
			startsAt: new Date(Date.now() - 60_000),
		})
		.where(eq(sessions.id, sessionId));
});

afterAll(async () => {
	if (sessionId) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}
});

describe("past session restrictions", () => {
	it("prevents requests and owner cancellation after the session starts", async () => {
		const requestResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				message: "This session has already started.",
			});

		expect(requestResponse.status).toBe(409);
		expect(requestResponse.body).toEqual({
			message: "Past sessions cannot be requested.",
		});

		const cancellationResponse = await request(app)
			.delete(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(cancellationResponse.status).toBe(409);
		expect(cancellationResponse.body).toEqual({
			message: "Started sessions cannot be cancelled.",
		});
	});
});
