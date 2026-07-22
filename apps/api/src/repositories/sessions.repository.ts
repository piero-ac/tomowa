import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, sessionRequests } from "../db/schema.js";
import type {
	CreateSessionInput,
	UpdateSessionInput,
} from "../types/session.js";

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

export async function deleteSession(sessionId: string, ownerId: string) {
	const [deletedSession] = await db
		.delete(sessions)
		.where(and(eq(sessions.id, sessionId), eq(sessions.ownerId, ownerId)))
		.returning({
			sessionId: sessions.id,
		});

	return deletedSession ?? null;
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
