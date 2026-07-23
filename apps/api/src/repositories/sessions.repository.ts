import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, sessionRequests } from "../db/schema.js";
import type {
	CreateSessionInput,
	UpdateSessionInput,
} from "../types/session.js";

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

export async function getSessions(limit: number) {
	return db
		.select({
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
		})
		.from(sessions)
		.where(and(eq(sessions.status, "open"), gte(sessions.startsAt, new Date())))
		.orderBy(asc(sessions.startsAt), asc(sessions.id))
		.limit(limit);
}

export async function getSessionById(sessionId: string) {
	const [session] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.limit(1);

	return session ?? null;
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
