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
import {
	toBookedSessionDto,
	toOwnedSessionDto,
	toSessionDto,
	toSessionWithOwnerDto,
} from "../mappers/session.mapper.js";
import { isPostgresUniqueViolation } from "../db/postgres-error.js";
import { buildPaginatedResponse } from "../lib/pagination.js";
import type { PaginationInput } from "../types/pagination.js";

export async function getSessions(input: PaginationInput) {
	const rows = await sessionRepository.getSessions(input);

	return buildPaginatedResponse(
		rows,
		input.limit,
		(row) => toSessionWithOwnerDto(row),
		(row) => ({
			sortValue: row.session.startsAt,
			id: row.session.id,
		}),
	);
}

export async function getOwnedSessions(
	ownerId: string,
	input: PaginationInput,
) {
	const rows = await sessionRepository.getOwnedSessions(ownerId, input);

	return buildPaginatedResponse(
		rows,
		input.limit,
		(row) => toOwnedSessionDto(row),
		(row) => ({
			sortValue: row.session.startsAt,
			id: row.session.id,
		}),
	);
}

export async function getBookedSessionsForUser(userId: string) {
	const bookedSessions =
		await sessionRepository.getBookedSessionsForUser(userId);

	return bookedSessions.map((session) => toBookedSessionDto(session));
}

export async function getSessionById(sessionId: string, viewerId: string) {
	const result = await sessionRepository.getSessionWithOwnerById(sessionId);

	if (!result) {
		throw new NotFoundError("Session not found.");
	}

	const canViewMeetingLink =
		result.session.ownerId === viewerId ||
		(await sessionRepository.isApprovedRequester(sessionId, viewerId));

	return toSessionWithOwnerDto(result, canViewMeetingLink);
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
	const result = await sessionRepository.deleteOrCancelSession(
		sessionId,
		ownerId,
	);

	switch (result.outcome) {
		case "deleted":
		case "cancelled":
			return;

		case "session_not_found":
			throw new NotFoundError("Session not found.");

		case "forbidden":
			throw new ForbiddenError(
				"Only the session owner can delete or cancel it.",
			);

		case "session_started":
			throw new ConflictError("Started sessions cannot be cancelled.");

		case "session_not_cancellable":
			throw new ConflictError(
				"Completed or cancelled sessions cannot be cancelled.",
			);

		default: {
			const unhandledResult: never = result;

			throw new Error(
				`Unhandled session cancellation result: ${JSON.stringify(unhandledResult)}`,
			);
		}
	}
}
