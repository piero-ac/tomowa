import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { getAccessToken } from "../helpers/auth.js";

const missingSessionId = "00000000-0000-4000-8000-000000000099";
const seededSessionId = "10000000-0000-4000-8000-000000000001";
const missingRequestId = "00000000-0000-4000-8000-000000000099";

let ownerToken: string;

beforeAll(async () => {
	ownerToken = await getAccessToken("owner@example.test");
});

describe("API error handling", () => {
	it("rejects an invalid session UUID", async () => {
		const response = await request(app)
			.get("/api/sessions/not-a-uuid")
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation failed.");
	});

	it("returns 404 for a missing session", async () => {
		const response = await request(app)
			.get(`/api/sessions/${missingSessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			message: "Session not found.",
		});
	});

	it("returns 404 for a missing session request", async () => {
		const response = await request(app)
			.post(
				`/api/sessions/${seededSessionId}/requests/${missingRequestId}/decline`,
			)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			message: "Session request not found.",
		});
	});

	it("rejects malformed JSON", async () => {
		const response = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${ownerToken}`)
			.set("Content-Type", "application/json")
			.send('{"title":');

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			message: "Malformed JSON.",
		});
	});

	it("rejects request bodies larger than 100kb", async () => {
		const oversizedBody = JSON.stringify({
			description: "x".repeat(101 * 1024),
		});

		const response = await request(app)
			.post("/api/sessions")
			.set("Authorization", `Bearer ${ownerToken}`)
			.set("Content-Type", "application/json")
			.send(oversizedBody);

		expect(response.status).toBe(413);
		expect(response.body).toEqual({
			message: "Request body is too large.",
		});
	});

	it("rejects an invalid session-list limit", async () => {
		const response = await request(app)
			.get("/api/sessions?limit=0")
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Invalid query parameters.");
	});
});
