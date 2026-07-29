import { and, asc, desc, eq, gt, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { profiles, sessionRequests, sessions } from "../db/schema.js";
import type {
	CreateSessionInput,
	UpdateSessionInput,
} from "../types/session.js";
import type { PaginationInput } from "../types/pagination.js";

export type DeleteOrCancelSessionResult =
	| {
			outcome: "deleted" | "cancelled";
	  }
	| {
			outcome:
				| "session_not_found"
				| "forbidden"
				| "session_started"
				| "session_not_cancellable";
	  };

export async function getSessions(input: PaginationInput) {
	const cursorCondition = input.cursor
		? or(
				gt(sessions.startsAt, input.cursor.sortValue),
				and(
					eq(sessions.startsAt, input.cursor.sortValue),
					gt(sessions.id, input.cursor.id),
				),
			)
		: undefined;

	return db
		.select({
			session: {
				id: sessions.id,
				ownerId: sessions.ownerId,
				title: sessions.title,
				targetLanguage: sessions.targetLanguage,
				helpLanguage: sessions.helpLanguage,
				startsAt: sessions.startsAt,
				durationMinutes: sessions.durationMinutes,
				status: sessions.status,
				imageKey: sessions.imageKey,
				description: sessions.description,
				createdAt: sessions.createdAt,
				updatedAt: sessions.updatedAt,
			},
			owner: profiles,
		})
		.from(sessions)
		.innerJoin(profiles, eq(profiles.id, sessions.ownerId))
		.where(
			and(
				eq(sessions.status, "open"),
				gte(sessions.startsAt, new Date()),
				cursorCondition,
			),
		)
		.orderBy(asc(sessions.startsAt), asc(sessions.id))
		.limit(input.limit + 1);
}

export async function getOwnedSessions(ownerId: string) {
	return db
		.select({
			session: sessions,
			owner: profiles,
			pendingRequestCount:
				sql<number>`count(${sessionRequests.id}) filter (where ${sessionRequests.status} = 'pending')`.mapWith(
					Number,
				),
			approvedRequestCount:
				sql<number>`count(${sessionRequests.id}) filter (where ${sessionRequests.status} = 'approved')`.mapWith(
					Number,
				),
			declinedRequestCount:
				sql<number>`count(${sessionRequests.id}) filter (where ${sessionRequests.status} = 'declined')`.mapWith(
					Number,
				),
			cancelledRequestCount:
				sql<number>`count(${sessionRequests.id}) filter (where ${sessionRequests.status} = 'cancelled')`.mapWith(
					Number,
				),
			totalRequestCount: sql<number>`count(${sessionRequests.id})`.mapWith(
				Number,
			),
		})
		.from(sessions)
		.innerJoin(profiles, eq(profiles.id, sessions.ownerId))
		.leftJoin(sessionRequests, eq(sessionRequests.sessionId, sessions.id))
		.where(eq(sessions.ownerId, ownerId))
		.groupBy(sessions.id, profiles.id)
		.orderBy(desc(sessions.startsAt), desc(sessions.id));
}

export async function getBookedSessionsForUser(userId: string) {
	return db
		.select({
			session: sessions,
			owner: profiles,
		})
		.from(sessions)
		.innerJoin(profiles, eq(profiles.id, sessions.ownerId))
		.leftJoin(
			sessionRequests,
			and(
				eq(sessionRequests.sessionId, sessions.id),
				eq(sessionRequests.status, "approved"),
			),
		)
		.where(
			and(
				eq(sessions.status, "booked"),
				gte(sessions.startsAt, new Date()),
				or(
					eq(sessions.ownerId, userId),
					eq(sessionRequests.requesterId, userId),
				),
			),
		)
		.orderBy(asc(sessions.startsAt), asc(sessions.id));
}

export async function getSessionById(sessionId: string) {
	const [session] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.limit(1);

	return session ?? null;
}

export async function getSessionWithOwnerById(sessionId: string) {
	const [result] = await db
		.select({
			session: sessions,
			owner: profiles,
		})
		.from(sessions)
		.innerJoin(profiles, eq(profiles.id, sessions.ownerId))
		.where(eq(sessions.id, sessionId))
		.limit(1);

	return result ?? null;
}

export async function createSession(input: CreateSessionInput) {
	const [createdSession] = await db
		.insert(sessions)
		.values({
			ownerId: input.ownerId,
			title: input.title,
			targetLanguage: input.targetLanguage,
			helpLanguage: input.helpLanguage,
			startsAt: input.startsAt,
			durationMinutes: input.durationMinutes,
			meetingLink: input.meetingLink,
			imageKey: input.imageKey ?? null,
			description: input.description,
		})
		.returning({ sessionId: sessions.id });

	return createdSession ?? null;
}

export async function updateSession(
	sessionId: string,
	ownerId: string,
	input: UpdateSessionInput,
) {
	const [updatedSession] = await db
		.update(sessions)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(and(eq(sessions.id, sessionId), eq(sessions.ownerId, ownerId)))
		.returning();

	return updatedSession ?? null;
}

export async function isApprovedRequester(
	sessionId: string,
	requesterId: string,
) {
	const [request] = await db
		.select({
			id: sessionRequests.id,
		})
		.from(sessionRequests)
		.where(
			and(
				eq(sessionRequests.sessionId, sessionId),
				eq(sessionRequests.requesterId, requesterId),
				eq(sessionRequests.status, "approved"),
			),
		)
		.limit(1);

	return request !== undefined;
}

export async function deleteOrCancelSession(
	sessionId: string,
	ownerId: string,
): Promise<DeleteOrCancelSessionResult> {
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

		if (session.status === "cancelled" || session.status === "completed") {
			return {
				outcome: "session_not_cancellable",
			};
		}

		if (session.startsAt <= new Date()) {
			return {
				outcome: "session_started",
			};
		}

		const [requestHistory] = await tx
			.select({
				id: sessionRequests.id,
			})
			.from(sessionRequests)
			.where(eq(sessionRequests.sessionId, sessionId))
			.limit(1);

		if (!requestHistory && session.status === "open") {
			await tx.delete(sessions).where(eq(sessions.id, sessionId));

			return {
				outcome: "deleted",
			};
		}

		const now = new Date();

		await tx
			.update(sessions)
			.set({
				status: "cancelled",
				updatedAt: now,
			})
			.where(eq(sessions.id, sessionId));

		await tx
			.update(sessionRequests)
			.set({
				status: "cancelled",
				updatedAt: now,
			})
			.where(
				and(
					eq(sessionRequests.sessionId, sessionId),
					inArray(sessionRequests.status, ["pending", "approved"]),
				),
			);

		return {
			outcome: "cancelled",
		};
	});
}
