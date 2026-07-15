import * as sessionRepository from "../repositories/sessions.repository.js";

import type { CreateSessionBody } from "../validation/session.schema.js";

export type CreateSessionInput = CreateSessionBody & {
	organizerId: string;
};

export async function getSessions() {
	const sessions = await sessionRepository.getSessions();
	return sessions.map(({ id, ...session }) => ({
		sessionId: id,
		...session,
	}));
}

export async function getSessionById(sessionId: string) {
	const session = await sessionRepository.getSessionById(sessionId);

	if (!session) {
		throw new Error("Session not found.");
	}

	// TODO: Hide meetingLink based on attendee and organizer id check
	const { id, ...sessionData } = session;
	return {
		sessionId: id,
		...sessionData,
	};
}

export async function createSession(input: CreateSessionInput) {
	if (input.startsAt <= new Date()) {
		throw new Error("Session must start in the future.");
	}

	return sessionRepository.createSession(input);
}
