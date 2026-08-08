import { and, eq } from "drizzle-orm";
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

	const response = await request(app)
		.post("/api/sessions")
		.set("Authorization", `Bearer ${ownerToken}`)
		.send({
			title: "Request Lifecycle Test",
			targetLanguage: "Japanese",
			helpLanguage: "English",
			startsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
			durationMinutes: 30,
			meetingLink: "https://example.test/request-lifecycle",
			description: "Temporary request-lifecycle test.",
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

describe("session request lifecycle", () => {
	it("allows a requester to create and cancel a pending request", async () => {
		const createResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				message: "I would like to join.",
			});

		const duplicateResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				message: "Duplicate request.",
			});

		expect(createResponse.status).toBe(201);
		expect(createResponse.body.status).toBe("pending");
		expect(createResponse.body.message).toBe("I would like to join.");
		expect(duplicateResponse.status).toBe(409);
		expect(duplicateResponse.body).toEqual({
			message: "You already have an active request for this session.",
		});

		const requestId = createResponse.body.requestId;

		const cancelResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests/${requestId}/cancel`)
			.set("Authorization", `Bearer ${requesterToken}`);

		expect(cancelResponse.status).toBe(200);
		expect(cancelResponse.body.status).toBe("cancelled");
	});

	it("prevents the owner from requesting their own session", async () => {
		const response = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				message: "Trying to request my own session.",
			});

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			message: "You cannot request your own session.",
		});
	});

	it("allows only the session owner to decline a pending request", async () => {
		const createResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				message: "Decline authorization test.",
			});

		expect(createResponse.status).toBe(201);

		const requestId = createResponse.body.requestId;

		const unauthorizedResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests/${requestId}/decline`)
			.set("Authorization", `Bearer ${otherToken}`);

		expect(unauthorizedResponse.status).toBe(403);
		expect(unauthorizedResponse.body).toEqual({
			message: "Only the session owner can decline requests.",
		});

		const ownerResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests/${requestId}/decline`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(ownerResponse.status).toBe(200);
		expect(ownerResponse.body.status).toBe("declined");

		const [storedRequest] = await db
			.select({
				status: sessionRequests.status,
			})
			.from(sessionRequests)
			.where(eq(sessionRequests.id, requestId));

		expect(storedRequest?.status).toBe("declined");
	});

	it("atomically approves one request, declines the other, and books the session", async () => {
		const requesterResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				message: "Please approve me.",
			});

		const otherResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${otherToken}`)
			.send({
				message: "I would also like to join.",
			});

		expect(requesterResponse.status).toBe(201);
		expect(otherResponse.status).toBe(201);

		const approvedRequestId = requesterResponse.body.requestId;
		const declinedRequestId = otherResponse.body.requestId;

		const approvalResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests/${approvedRequestId}/approve`)
			.set("Authorization", `Bearer ${ownerToken}`);

		const unauthorizedApprovalResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests/${approvedRequestId}/approve`)
			.set("Authorization", `Bearer ${otherToken}`);

		expect(unauthorizedApprovalResponse.status).toBe(403);
		expect(unauthorizedApprovalResponse.body).toEqual({
			message: "Only the session owner can approve requests.",
		});

		const unauthorizedRequestCancellationResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests/${approvedRequestId}/cancel`)
			.set("Authorization", `Bearer ${otherToken}`);

		expect(unauthorizedRequestCancellationResponse.status).toBe(403);
		expect(unauthorizedRequestCancellationResponse.body).toEqual({
			message: "Only the requester can cancel this request.",
		});

		expect(approvalResponse.status).toBe(200);
		expect(approvalResponse.body.status).toBe("approved");

		const [storedSession] = await db
			.select({
				status: sessions.status,
			})
			.from(sessions)
			.where(eq(sessions.id, sessionId));

		const [storedApprovedRequest] = await db
			.select({
				status: sessionRequests.status,
			})
			.from(sessionRequests)
			.where(
				and(
					eq(sessionRequests.id, approvedRequestId),
					eq(sessionRequests.sessionId, sessionId),
				),
			);

		const [storedDeclinedRequest] = await db
			.select({
				status: sessionRequests.status,
			})
			.from(sessionRequests)
			.where(
				and(
					eq(sessionRequests.id, declinedRequestId),
					eq(sessionRequests.sessionId, sessionId),
				),
			);

		expect(storedSession?.status).toBe("booked");
		expect(storedApprovedRequest?.status).toBe("approved");
		expect(storedDeclinedRequest?.status).toBe("declined");

		const bookedUpdateResponse = await request(app)
			.patch(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				startsAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
			});

		expect(bookedUpdateResponse.status).toBe(409);
		expect(bookedUpdateResponse.body).toEqual({
			message: "A booked session's start time cannot be changed.",
		});

		const approvedViewerResponse = await request(app)
			.get(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${requesterToken}`);

		const declinedViewerResponse = await request(app)
			.get(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${otherToken}`);

		expect(approvedViewerResponse.status).toBe(200);
		expect(approvedViewerResponse.body.meetingLink).toBe(
			"https://example.test/request-lifecycle",
		);

		expect(declinedViewerResponse.status).toBe(200);
		expect(declinedViewerResponse.body).not.toHaveProperty("meetingLink");

		const cancellationResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests/${approvedRequestId}/cancel`)
			.set("Authorization", `Bearer ${requesterToken}`);

		expect(cancellationResponse.status).toBe(200);
		expect(cancellationResponse.body.status).toBe("cancelled");

		const [reopenedSession] = await db
			.select({
				status: sessions.status,
			})
			.from(sessions)
			.where(eq(sessions.id, sessionId));

		expect(reopenedSession?.status).toBe("open");

		const afterCancellationResponse = await request(app)
			.get(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${requesterToken}`);

		expect(afterCancellationResponse.status).toBe(200);
		expect(afterCancellationResponse.body).not.toHaveProperty("meetingLink");

		const newRequestResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${otherToken}`)
			.send({
				message: "Request after the session reopened.",
			});

		expect(newRequestResponse.status).toBe(201);
		expect(newRequestResponse.body.status).toBe("pending");

		const newRequestId = newRequestResponse.body.requestId;

		const unauthorizedCancellationResponse = await request(app)
			.delete(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${otherToken}`);

		expect(unauthorizedCancellationResponse.status).toBe(403);

		const ownerCancellationResponse = await request(app)
			.delete(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`);

		expect(ownerCancellationResponse.status).toBe(204);

		const [cancelledSession] = await db
			.select({
				status: sessions.status,
			})
			.from(sessions)
			.where(eq(sessions.id, sessionId));

		const [cancelledPendingRequest] = await db
			.select({
				status: sessionRequests.status,
			})
			.from(sessionRequests)
			.where(eq(sessionRequests.id, newRequestId));

		expect(cancelledSession?.status).toBe("cancelled");
		expect(cancelledPendingRequest?.status).toBe("cancelled");

		const cancelledSessionRequestResponse = await request(app)
			.post(`/api/sessions/${sessionId}/requests`)
			.set("Authorization", `Bearer ${requesterToken}`)
			.send({
				message: "Requesting a cancelled session.",
			});

		expect(cancelledSessionRequestResponse.status).toBe(409);
		expect(cancelledSessionRequestResponse.body).toEqual({
			message: "Only open sessions can be requested.",
		});

		const cancelledSessionUpdateResponse = await request(app)
			.patch(`/api/sessions/${sessionId}`)
			.set("Authorization", `Bearer ${ownerToken}`)
			.send({
				title: "Attempted Cancelled Update",
			});

		expect(cancelledSessionUpdateResponse.status).toBe(409);
		expect(cancelledSessionUpdateResponse.body).toEqual({
			message: "Cancelled or completed sessions cannot be updated.",
		});
	});
});
