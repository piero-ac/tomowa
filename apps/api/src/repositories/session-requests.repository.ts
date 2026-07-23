import { db } from "../db/index.js";
import { sessionRequests } from "../db/schema.js";
import type { CreateSessionRequestInput } from "../types/session-request.js";
import { and, eq } from "drizzle-orm";

export async function createSessionRequest(input: CreateSessionRequestInput) {
	const [createdRequest] = await db
		.insert(sessionRequests)
		.values({
			sessionId: input.sessionId,
			requesterId: input.requesterId,
			message: input.message ?? null,
		})
		.returning();

	return createdRequest ?? null;
}

export async function getSessionRequest(sessionId: string, requestId: string) {
	const [request] = await db
		.select()
		.from(sessionRequests)
		.where(
			and(
				eq(sessionRequests.id, requestId),
				eq(sessionRequests.sessionId, sessionId),
			),
		)
		.limit(1);

	return request ?? null;
}

export async function declineSessionRequest(
	sessionId: string,
	requestId: string,
) {
	const now = new Date();

	const [declinedRequest] = await db
		.update(sessionRequests)
		.set({
			status: "declined",
			respondedAt: now,
			updatedAt: now,
		})
		.where(
			and(
				eq(sessionRequests.id, requestId),
				eq(sessionRequests.sessionId, sessionId),
				eq(sessionRequests.status, "pending"),
			),
		)
		.returning();

	return declinedRequest ?? null;
}

export async function cancelPendingSessionRequest(
	sessionId: string,
	requestId: string,
	requesterId: string,
) {
	const [cancelledRequest] = await db
		.update(sessionRequests)
		.set({
			status: "cancelled",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(sessionRequests.id, requestId),
				eq(sessionRequests.sessionId, sessionId),
				eq(sessionRequests.requesterId, requesterId),
				eq(sessionRequests.status, "pending"),
			),
		)
		.returning();

	return cancelledRequest ?? null;
}
