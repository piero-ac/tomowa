import * as sessionRepository from "../repositories/sessions.repository.js";
import type {
	CreateSessionInput,
	CreateSessionResponseDto,
	UpdateSessionInput,
} from "../types/session.js";
import {
	BadRequestError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../errors/index.js";
import { toSessionDto } from "../mappers/session.mapper.js";
import { isPostgresUniqueViolation } from "../db/postgres-error.js";

export async function getSessions(limit: number) {
	const sessions = await sessionRepository.getSessions(limit);
	return sessions.map((session) => toSessionDto(session));
}

export async function getSessionById(sessionId: string, viewerId: string) {
	const session = await sessionRepository.getSessionById(sessionId);

	if (!session) {
		throw new NotFoundError("Session not found.");
	}

	const canViewMeetingLink =
		session.ownerId === viewerId ||
		(await sessionRepository.isApprovedRequester(sessionId, viewerId));
	return toSessionDto(session, canViewMeetingLink);
}

export async function createSession(
	input: CreateSessionInput,
): Promise<CreateSessionResponseDto> {
	if (input.startsAt <= new Date()) {
		throw new BadRequestError("Session must start in the future.");
	}

	try {
		const createdSession = await sessionRepository.createSession(input);

		if (!createdSession) {
			throw new Error("Session could not be created.");
		}

		return createdSession;
	} catch (error) {
		if (
			isPostgresUniqueViolation(error, "sessions_owner_active_start_unique_idx")
		) {
			throw new ConflictError(
				"You already have an active session at this start time.",
			);
		}

		throw error;
	}
}

export async function updateSession(
	sessionId: string,
	ownerId: string,
	input: UpdateSessionInput,
) {
	const existingSession = await sessionRepository.getSessionById(sessionId);

	if (!existingSession) {
		throw new NotFoundError("Session not found.");
	}

	if (existingSession.ownerId !== ownerId) {
		throw new ForbiddenError("Update not allowed.");
	}

	if (
		existingSession.status === "cancelled" ||
		existingSession.status === "completed"
	) {
		throw new ConflictError(
			"Cancelled or completed sessions cannot be updated.",
		);
	}

	if (existingSession.status === "booked" && input.startsAt !== undefined) {
		throw new ConflictError("A booked session's start time cannot be changed.");
	}

	if (input.startsAt && input.startsAt <= new Date()) {
		throw new BadRequestError("Session must start in the future.");
	}

	try {
		const updatedSession = await sessionRepository.updateSession(
			sessionId,
			ownerId,
			input,
		);

		if (!updatedSession) {
			throw new Error("Session could not be updated.");
		}

		return toSessionDto(updatedSession, true);
	} catch (error) {
		if (
			isPostgresUniqueViolation(error, "sessions_owner_active_start_unique_idx")
		) {
			throw new ConflictError(
				"You already have an active session at this start time.",
			);
		}

		throw error;
	}
}

export async function deleteSession(sessionId: string, ownerId: string) {
	const existingSession = await sessionRepository.getSessionById(sessionId);

	if (!existingSession) {
		throw new NotFoundError("Session not found.");
	}

	if (existingSession.ownerId !== ownerId) {
		throw new ForbiddenError("Deletion not allowed.");
	}

	if (existingSession.status !== "open") {
		throw new ConflictError("Only open sessions can be permanently deleted.");
	}

	const hasRequestHistory =
		await sessionRepository.hasSessionRequests(sessionId);

	if (hasRequestHistory) {
		throw new ConflictError(
			"Sessions with request history cannot be permanently deleted.",
		);
	}

	const deletedSession = await sessionRepository.deleteSession(
		sessionId,
		ownerId,
	);

	if (!deletedSession) {
		throw new ConflictError(
			"Session could not be deleted because its state changed.",
		);
	}
}
