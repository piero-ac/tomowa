import { db } from "../db/index.js";
import { sessionRequests, sessions } from "../db/schema.js";
import type { CreateSessionRequestInput } from "../types/session-request.js";
import { and, eq, ne } from "drizzle-orm";
import type { SelectSessionRequest } from "../db/schema.js";

export type ApproveSessionRequestResult =
	| {
			outcome: "approved";
			request: SelectSessionRequest;
	  }
	| {
			outcome:
				| "session_not_found"
				| "forbidden"
				| "session_not_open"
				| "session_started"
				| "request_not_found"
				| "request_not_pending";
	  };

export type CancelApprovedBookingResult =
	| {
			outcome: "cancelled";
			request: SelectSessionRequest;
	  }
	| {
			outcome:
				| "session_not_found"
				| "request_not_found"
				| "forbidden"
				| "request_not_approved"
				| "session_not_booked"
				| "session_started";
	  };

export type CreateSessionRequestResult =
	| {
			outcome: "created";
			request: SelectSessionRequest;
	  }
	| {
			outcome:
				| "session_not_found"
				| "forbidden"
				| "session_not_open"
				| "session_started";
	  };

export async function createSessionRequest(
	input: CreateSessionRequestInput,
): Promise<CreateSessionRequestResult> {
	return db.transaction(async (tx) => {
		const [session] = await tx
			.select()
			.from(sessions)
			.where(eq(sessions.id, input.sessionId))
			.limit(1)
			.for("update");

		if (!session) {
			return {
				outcome: "session_not_found",
			};
		}

		if (session.ownerId === input.requesterId) {
			return {
				outcome: "forbidden",
			};
		}

		if (session.status !== "open") {
			return {
				outcome: "session_not_open",
			};
		}

		if (session.startsAt <= new Date()) {
			return {
				outcome: "session_started",
			};
		}

		const [createdRequest] = await tx
			.insert(sessionRequests)
			.values({
				sessionId: input.sessionId,
				requesterId: input.requesterId,
				message: input.message ?? null,
			})
			.returning();

		if (!createdRequest) {
			throw new Error("Session request was not returned.");
		}

		return {
			outcome: "created",
			request: createdRequest,
		};
	});
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

export async function approveSessionRequest(
	sessionId: string,
	requestId: string,
	ownerId: string,
): Promise<ApproveSessionRequestResult> {
	return db.transaction(async (tx) => {
		const [session] = await tx
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.limit(1)
			.for("update");

		if (!session) {
			return {
				outcome: "session_not_found",
			};
		}

		if (session.ownerId !== ownerId) {
			return {
				outcome: "forbidden",
			};
		}

		if (session.status !== "open") {
			return {
				outcome: "session_not_open",
			};
		}

		if (session.startsAt <= new Date()) {
			return {
				outcome: "session_started",
			};
		}

		const [request] = await tx
			.select()
			.from(sessionRequests)
			.where(
				and(
					eq(sessionRequests.id, requestId),
					eq(sessionRequests.sessionId, sessionId),
				),
			)
			.limit(1)
			.for("update");

		if (!request) {
			return {
				outcome: "request_not_found",
			};
		}

		if (request.status !== "pending") {
			return {
				outcome: "request_not_pending",
			};
		}

		const now = new Date();

		const [approvedRequest] = await tx
			.update(sessionRequests)
			.set({
				status: "approved",
				respondedAt: now,
				updatedAt: now,
			})
			.where(eq(sessionRequests.id, requestId))
			.returning();

		if (!approvedRequest) {
			throw new Error("Approved request was not returned.");
		}

		await tx
			.update(sessionRequests)
			.set({
				status: "declined",
				respondedAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(sessionRequests.sessionId, sessionId),
					eq(sessionRequests.status, "pending"),
					ne(sessionRequests.id, requestId),
				),
			);

		await tx
			.update(sessions)
			.set({
				status: "booked",
				updatedAt: now,
			})
			.where(eq(sessions.id, sessionId));

		return {
			outcome: "approved",
			request: approvedRequest,
		};
	});
}

export async function cancelApprovedBooking(
	sessionId: string,
	requestId: string,
	requesterId: string,
): Promise<CancelApprovedBookingResult> {
	return db.transaction(async (tx) => {
		const [session] = await tx
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.limit(1)
			.for("update");

		if (!session) {
			return {
				outcome: "session_not_found",
			};
		}

		const [request] = await tx
			.select()
			.from(sessionRequests)
			.where(
				and(
					eq(sessionRequests.id, requestId),
					eq(sessionRequests.sessionId, sessionId),
				),
			)
			.limit(1)
			.for("update");

		if (!request) {
			return {
				outcome: "request_not_found",
			};
		}

		if (request.requesterId !== requesterId) {
			return {
				outcome: "forbidden",
			};
		}

		if (request.status !== "approved") {
			return {
				outcome: "request_not_approved",
			};
		}

		if (session.status !== "booked") {
			return {
				outcome: "session_not_booked",
			};
		}

		if (session.startsAt <= new Date()) {
			return {
				outcome: "session_started",
			};
		}

		const now = new Date();

		const [cancelledRequest] = await tx
			.update(sessionRequests)
			.set({
				status: "cancelled",
				updatedAt: now,
			})
			.where(eq(sessionRequests.id, requestId))
			.returning();

		if (!cancelledRequest) {
			throw new Error("Cancelled request was not returned.");
		}

		await tx
			.update(sessions)
			.set({
				status: "open",
				updatedAt: now,
			})
			.where(eq(sessions.id, sessionId));

		return {
			outcome: "cancelled",
			request: cancelledRequest,
		};
	});
}
