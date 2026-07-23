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
	try {
		const result = await sessionRequestRepository.createSessionRequest(input);

		switch (result.outcome) {
			case "created":
				return toSessionRequestDto(result.request);

			case "session_not_found":
				throw new NotFoundError("Session not found.");

			case "forbidden":
				throw new ForbiddenError("You cannot request your own session.");

			case "session_not_open":
				throw new ConflictError("Only open sessions can be requested.");

			case "session_started":
				throw new ConflictError("Past sessions cannot be requested.");

			default: {
				const unhandledResult: never = result;

				throw new Error(
					`Unhandled request creation result: ${JSON.stringify(unhandledResult)}`,
				);
			}
		}
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

	if (request.status === "pending") {
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

	if (request.status !== "approved") {
		throw new ConflictError(
			"Only pending or approved requests can be cancelled.",
		);
	}

	const result = await sessionRequestRepository.cancelApprovedBooking(
		sessionId,
		requestId,
		requesterId,
	);

	switch (result.outcome) {
		case "cancelled":
			return toSessionRequestDto(result.request);

		case "session_not_found":
			throw new NotFoundError("Session not found.");

		case "request_not_found":
			throw new NotFoundError("Session request not found.");

		case "forbidden":
			throw new ForbiddenError("Only the requester can cancel this booking.");

		case "request_not_approved":
			throw new ConflictError("Request is no longer approved.");

		case "session_not_booked":
			throw new ConflictError("Session is no longer booked.");

		case "session_started":
			throw new ConflictError("Started sessions cannot be cancelled.");

		default: {
			const unhandledResult: never = result;

			throw new Error(
				`Unhandled cancellation result: ${JSON.stringify(unhandledResult)}`,
			);
		}
	}
}

export async function approveSessionRequest(
	sessionId: string,
	requestId: string,
	ownerId: string,
) {
	try {
		const result = await sessionRequestRepository.approveSessionRequest(
			sessionId,
			requestId,
			ownerId,
		);

		switch (result.outcome) {
			case "approved":
				return toSessionRequestDto(result.request);

			case "session_not_found":
				throw new NotFoundError("Session not found.");

			case "forbidden":
				throw new ForbiddenError(
					"Only the session owner can approve requests.",
				);

			case "session_not_open":
				throw new ConflictError("Only open sessions can approve requests.");

			case "session_started":
				throw new ConflictError("Past sessions cannot approve requests.");

			case "request_not_found":
				throw new NotFoundError("Session request not found.");

			case "request_not_pending":
				throw new ConflictError("Only pending requests can be approved.");

			default: {
				const unhandledResult: never = result;

				throw new Error(
					`Unhandled approval result: ${JSON.stringify(unhandledResult)}`,
				);
			}
		}
	} catch (error) {
		if (isPostgresUniqueViolation(error, "session_requests_one_approved_idx")) {
			throw new ConflictError(
				"This session already has an approved requester.",
			);
		}

		throw error;
	}
}
