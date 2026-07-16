import { eq } from "drizzle-orm";
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
			organizerId: sessions.organizerId,
			title: sessions.title,
			targetLanguage: sessions.targetLanguage,
			helpLanguage: sessions.helpLanguage,
			startsAt: sessions.startsAt,
			capacity: sessions.capacity,
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

	return createdSession;
}

export async function updateSession(
	sessionId: string,
	input: UpdateSessionInput,
) {
	const [updatedSession] = await db
		.update(sessions)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(eq(sessions.id, sessionId))
		.returning();

	return updatedSession ?? null;
}
