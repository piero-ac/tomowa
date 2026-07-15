import { db } from "../db/index.js";
import { sessions } from "../db/schema.js";
import type { CreateSessionInput } from "../services/sessions.service.js";

export async function getSessions() {
	return db.select().from(sessions);
}

export async function createSession(input: CreateSessionInput) {
	const [createdSession] = await db
		.insert(sessions)
		.values(input)
		.returning({ sessionId: sessions.id });

	return createdSession;
}
