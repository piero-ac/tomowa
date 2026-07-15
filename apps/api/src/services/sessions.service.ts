import * as sessionRepository from "../repositories/sessions.repository.js";

import type { CreateSessionBody } from "../validation/session.schema.js";

export type CreateSessionInput = CreateSessionBody & {
	organizerId: string;
};

export async function getSessions() {
	return sessionRepository.getSessions();
}

export async function createSession(input: CreateSessionInput) {
	if (input.startsAt <= new Date()) {
		throw new Error("Session must start in the future.");
	}

	return sessionRepository.createSession(input);
}
