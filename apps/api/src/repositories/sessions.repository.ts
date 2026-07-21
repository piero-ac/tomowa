import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions } from "../db/schema.js";
import type {
	CreateSessionInput,
	UpdateSessionInput,
} from "../types/session.js";

export async function getSessions() {
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
		.from(sessions);
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
		.values(input)
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
