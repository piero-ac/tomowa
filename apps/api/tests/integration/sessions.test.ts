import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { getAccessToken } from "../helpers/auth.js";

const sessionId = "10000000-0000-4000-8000-000000000001";

let ownerToken: string;
let requesterToken: string;
let otherToken: string;

beforeAll(async () => {
	[ownerToken, requesterToken, otherToken] = await Promise.all([
		getAccessToken("owner@example.test"),
		getAccessToken("requester@example.test"),
		getAccessToken("other@example.test"),
	]);
});

describe("GET /api/sessions", () => {
	it("returns open sessions without exposing meeting links", async () => {
		const response = await request(app)
			.get("/api/sessions")
			.set("Authorization", `Bearer ${requesterToken}`);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.body)).toBe(true);
		expect(response.body.length).toBeGreaterThanOrEqual(2);

		for (const session of response.body) {
			expect(session).not.toHaveProperty("meetingLink");
		}
	});
});

describe("GET /api/sessions/:sessionId", () => {
	it("shows the meeting link to the session owner", async () => {
		const response = await request(app)
			.get(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(200);
		expect(response.body.meetingLink).toBe(
			"https://example.test/meeting/japanese",
		);
	});

	it("hides the meeting link from an unrelated user", async () => {
		const response = await request(app)
			.get(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${otherToken}`);

		expect(response.status).toBe(200);
		expect(response.body).not.toHaveProperty("meetingLink");
	});
});

describe("POST /api/sessions", () => {
	it("rejects an invalid session body", async () => {
		const response = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation failed.");
		expect(response.body).toHaveProperty("errors");
	});

	it("rejects a client-supplied owner ID", async () => {
		const response = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				ownerId: "bb15a872-fe39-4d13-a440-c826d0a31bfc",
				title: "Ownership Test",
				targetLanguage: "Japanese",
				helpLanguage: "English",
				startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
				durationMinutes: 30,
				meetingLink: "https://example.test/private",
				description: "The API must derive ownership from the JWT.",
			});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation failed.");
	});
});
