import * as sessionRepository from "../repositories/sessions.repository.js";
import type {
	CreateSessionInput,
	UpdateSessionInput,
} from "../types/session.js";

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

export async function updateSession(
	sessionId: string,
	input: UpdateSessionInput,
) {
	const existingSession = await sessionRepository.getSessionById(sessionId);

	if (!existingSession) {
		throw new Error("Session not found.");
	}

	if (input.startsAt && input.startsAt <= new Date()) {
		throw new Error("Session must start in the future.");
	}

	const updatedSession = await sessionRepository.updateSession(
		sessionId,
		input,
	);

	if (!updatedSession) {
		throw new Error("Session could not be updated.");
	}

	// TODO: Hide meetingLink based on organizer/selected partner authorization.
	const { id, ...sessionData } = updatedSession;

	return {
		sessionId: id,
		...sessionData,
	};
}

export async function deleteSession(sessionId: string, organizerId: string) {
	const existingSession = await sessionRepository.getSessionById(sessionId);

	if (!existingSession) {
		throw new Error("Session not found.");
	}

	if (existingSession.organizerId !== organizerId) {
		throw new Error("Deletion not allowed");
	}

	const deletedSession = await sessionRepository.deleteSession(
		sessionId,
		organizerId,
	);

	if (!deletedSession) {
		throw new Error("Session could not be deleted.");
	}
}
