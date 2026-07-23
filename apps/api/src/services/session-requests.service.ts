import { isPostgresUniqueViolation } from "../db/postgres-error.js";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../errors/index.js";
import { toSessionRequestDto } from "../mappers/session-request.mapper.js";
import * as sessionRequestRepository from "../repositories/session-requests.repository.js";
import * as sessionRepository from "../repositories/sessions.repository.js";
import type { CreateSessionRequestInput } from "../types/session-request.js";

export async function createSessionRequest(input: CreateSessionRequestInput) {
	const session = await sessionRepository.getSessionById(input.sessionId);

	if (!session) {
		throw new NotFoundError("Session not found.");
	}

	if (session.ownerId === input.requesterId) {
		throw new ForbiddenError("You cannot request your own session.");
	}

	if (session.status !== "open") {
		throw new ConflictError("Only open sessions can be requested.");
	}

	if (session.startsAt <= new Date()) {
		throw new ConflictError("Past sessions cannot be requested.");
	}

	try {
		const createdRequest =
			await sessionRequestRepository.createSessionRequest(input);

		if (!createdRequest) {
			throw new Error("Session request could not be created.");
		}

		return toSessionRequestDto(createdRequest);
	} catch (error) {
		if (
			isPostgresUniqueViolation(
				error,
				"session_requests_one_active_per_user_idx",
			)
		) {
			throw new ConflictError(
				"You already have an active request for this session.",
			);
		}

		throw error;
	}
}

export async function declineSessionRequest(
	sessionId: string,
	requestId: string,
	ownerId: string,
) {
	const request = await sessionRequestRepository.getSessionRequest(
		sessionId,
		requestId,
	);

	if (!request) {
		throw new NotFoundError("Session request not found.");
	}

	const session = await sessionRepository.getSessionById(sessionId);

	if (!session) {
		throw new NotFoundError("Session not found.");
	}

	if (session.ownerId !== ownerId) {
		throw new ForbiddenError("Only the session owner can decline requests.");
	}

	if (request.status !== "pending") {
		throw new ConflictError("Only pending requests can be declined.");
	}

	const declinedRequest = await sessionRequestRepository.declineSessionRequest(
		sessionId,
		requestId,
	);

	if (!declinedRequest) {
		throw new ConflictError(
			"Request could not be declined because its state changed.",
		);
	}

	return toSessionRequestDto(declinedRequest);
}

export async function cancelSessionRequest(
	sessionId: string,
	requestId: string,
	requesterId: string,
) {
	const request = await sessionRequestRepository.getSessionRequest(
		sessionId,
		requestId,
	);

	if (!request) {
		throw new NotFoundError("Session request not found.");
	}

	if (request.requesterId !== requesterId) {
		throw new ForbiddenError("Only the requester can cancel this request.");
	}

	if (request.status !== "pending") {
		throw new ConflictError("Only pending requests can be cancelled.");
	}

	const cancelledRequest =
		await sessionRequestRepository.cancelPendingSessionRequest(
			sessionId,
			requestId,
			requesterId,
		);

	if (!cancelledRequest) {
		throw new ConflictError(
			"Request could not be cancelled because its state changed.",
		);
	}

	return toSessionRequestDto(cancelledRequest);
}
