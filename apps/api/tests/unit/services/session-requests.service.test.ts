import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	SelectProfile,
	SelectSession,
	SelectSessionRequest,
} from "../../../src/db/schema.js";
import { decodeCursor } from "../../../src/lib/pagination.js";
import * as sessionRequestRepository from "../../../src/repositories/session-requests.repository.js";
import * as sessionRepository from "../../../src/repositories/sessions.repository.js";
import * as sessionRequestService from "../../../src/services/session-requests.service.js";
import type { CreateSessionRequestInput } from "../../../src/types/session-request.js";

vi.mock("../../../src/repositories/session-requests.repository.js", () => ({
	createSessionRequest: vi.fn(),
	getSessionRequest: vi.fn(),
	getSessionRequests: vi.fn(),
	getUserSessionRequests: vi.fn(),
	declineSessionRequest: vi.fn(),
	cancelPendingSessionRequest: vi.fn(),
	cancelApprovedBooking: vi.fn(),
	approveSessionRequest: vi.fn(),
}));

vi.mock("../../../src/repositories/sessions.repository.js", () => ({
	getSessionById: vi.fn(),
}));

const ownerId = "10000000-0000-4000-8000-000000000001";
const requesterId = "10000000-0000-4000-8000-000000000002";
const otherUserId = "10000000-0000-4000-8000-000000000003";
const sessionId = "20000000-0000-4000-8000-000000000001";
const requestId = "30000000-0000-4000-8000-000000000001";
const secondRequestId = "30000000-0000-4000-8000-000000000002";

const session: SelectSession = {
	id: sessionId,
	ownerId,
	title: "Japanese Conversation",
	targetLanguage: "Japanese",
	helpLanguage: "English",
	startsAt: new Date("2030-01-15T18:00:00.000Z"),
	durationMinutes: 30,
	status: "open",
	meetingLink: "https://example.test/meeting",
	imageKey: null,
	description: "Practice everyday conversation.",
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const pendingRequest: SelectSessionRequest = {
	id: requestId,
	sessionId,
	requesterId,
	status: "pending",
	message: "I would like to join.",
	createdAt: new Date("2026-01-03T00:00:00.000Z"),
	respondedAt: null,
	updatedAt: new Date("2026-01-03T00:00:00.000Z"),
};

const requesterProfile: SelectProfile = {
	id: requesterId,
	displayName: "Session Requester",
	username: "session_requester",
	bio: null,
	avatarKey: null,
	nativeLanguage: "English",
	learningLanguage: "Japanese",
	timezone: "America/New_York",
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const ownerProfile: SelectProfile = {
	...requesterProfile,
	id: ownerId,
	displayName: "Session Owner",
	username: "session_owner",
};

const createSessionRequestMock = vi.mocked(
	sessionRequestRepository.createSessionRequest,
);
const getSessionRequestMock = vi.mocked(
	sessionRequestRepository.getSessionRequest,
);
const getSessionRequestsMock = vi.mocked(
	sessionRequestRepository.getSessionRequests,
);
const getUserSessionRequestsMock = vi.mocked(
	sessionRequestRepository.getUserSessionRequests,
);
const declineSessionRequestMock = vi.mocked(
	sessionRequestRepository.declineSessionRequest,
);
const cancelPendingSessionRequestMock = vi.mocked(
	sessionRequestRepository.cancelPendingSessionRequest,
);
const cancelApprovedBookingMock = vi.mocked(
	sessionRequestRepository.cancelApprovedBooking,
);
const approveSessionRequestMock = vi.mocked(
	sessionRequestRepository.approveSessionRequest,
);
const getSessionByIdMock = vi.mocked(sessionRepository.getSessionById);

beforeEach(() => {
	vi.resetAllMocks();
});

describe("createSessionRequest", () => {
	const input: CreateSessionRequestInput = {
		sessionId,
		requesterId,
		message: "I would like to join.",
	};

	it("returns a mapped request when creation succeeds", async () => {
		createSessionRequestMock.mockResolvedValue({
			outcome: "created",
			request: pendingRequest,
		});

		const result = await sessionRequestService.createSessionRequest(input);

		expect(result).toEqual({
			requestId,
			sessionId,
			requesterId,
			status: "pending",
			message: "I would like to join.",
			createdAt: "2026-01-03T00:00:00.000Z",
			respondedAt: null,
			updatedAt: "2026-01-03T00:00:00.000Z",
		});
		expect(createSessionRequestMock).toHaveBeenCalledWith(input);
	});

	it.each([
		["session_not_found", "NotFoundError", 404, "Session not found."],
		[
			"forbidden",
			"ForbiddenError",
			403,
			"You cannot request your own session.",
		],
		[
			"session_not_open",
			"ConflictError",
			409,
			"Only open sessions can be requested.",
		],
		[
			"session_started",
			"ConflictError",
			409,
			"Past sessions cannot be requested.",
		],
	] as const)(
		"translates the %s outcome",
		async (outcome, errorName, statusCode, message) => {
			createSessionRequestMock.mockResolvedValue({ outcome });

			await expect(
				sessionRequestService.createSessionRequest(input),
			).rejects.toMatchObject({
				name: errorName,
				statusCode,
				message,
			});
		},
	);

	it("translates the active-request unique constraint into a conflict", async () => {
		const uniqueViolation = Object.assign(new Error("Duplicate request."), {
			code: "23505",
			constraint_name: "session_requests_one_active_per_user_idx",
		});

		createSessionRequestMock.mockRejectedValue(uniqueViolation);

		await expect(
			sessionRequestService.createSessionRequest(input),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "You already have an active request for this session.",
		});
	});

	it("preserves unexpected repository errors", async () => {
		const repositoryError = new Error("Database unavailable.");

		createSessionRequestMock.mockRejectedValue(repositoryError);

		await expect(
			sessionRequestService.createSessionRequest(input),
		).rejects.toBe(repositoryError);
	});

	it("rejects an unexpected repository outcome", async () => {
		createSessionRequestMock.mockResolvedValue({
			outcome: "unexpected",
		} as never);

		await expect(
			sessionRequestService.createSessionRequest(input),
		).rejects.toThrow(
			'Unhandled request creation result: {"outcome":"unexpected"}',
		);
	});
});

describe("request reads", () => {
	it("throws not found when listing requests for a missing session", async () => {
		getSessionByIdMock.mockResolvedValue(null);

		await expect(
			sessionRequestService.getSessionRequests(sessionId, ownerId, {
				limit: 20,
			}),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Session not found.",
		});
		expect(getSessionRequestsMock).not.toHaveBeenCalled();
	});

	it("prevents a non-owner from listing a session's requests", async () => {
		getSessionByIdMock.mockResolvedValue(session);

		await expect(
			sessionRequestService.getSessionRequests(sessionId, otherUserId, {
				limit: 20,
			}),
		).rejects.toMatchObject({
			name: "ForbiddenError",
			statusCode: 403,
			message: "Only the session owner can view its requests.",
		});
		expect(getSessionRequestsMock).not.toHaveBeenCalled();
	});

	it("maps and paginates requests for the session owner", async () => {
		const input = { limit: 1 };
		const secondRequest = {
			...pendingRequest,
			id: secondRequestId,
			createdAt: new Date("2026-01-02T00:00:00.000Z"),
		};

		getSessionByIdMock.mockResolvedValue(session);
		getSessionRequestsMock.mockResolvedValue([
			{
				request: pendingRequest,
				requester: requesterProfile,
			},
			{
				request: secondRequest,
				requester: requesterProfile,
			},
		]);

		const page = await sessionRequestService.getSessionRequests(
			sessionId,
			ownerId,
			input,
		);

		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({
			requestId,
			requester: {
				userId: requesterId,
				displayName: "Session Requester",
			},
		});
		expect(page.nextCursor).toEqual(expect.any(String));

		if (!page.nextCursor) {
			throw new Error("Expected a next cursor.");
		}

		expect(decodeCursor(page.nextCursor)).toEqual({
			sortValue: pendingRequest.createdAt,
			id: requestId,
		});
		expect(getSessionRequestsMock).toHaveBeenCalledWith(sessionId, input);
	});

	it("maps and paginates the requester's own history", async () => {
		const input = { limit: 20 };
		const approvedRequest = {
			...pendingRequest,
			status: "approved" as const,
			respondedAt: new Date("2026-01-04T00:00:00.000Z"),
		};

		getUserSessionRequestsMock.mockResolvedValue([
			{
				request: approvedRequest,
				session: {
					...session,
					status: "booked",
				},
				owner: ownerProfile,
			},
		]);

		const page = await sessionRequestService.getUserSessionRequests(
			requesterId,
			input,
		);

		expect(page).toMatchObject({
			items: [
				{
					requestId,
					status: "approved",
					respondedAt: "2026-01-04T00:00:00.000Z",
					session: {
						sessionId,
						meetingLink: "https://example.test/meeting",
						owner: {
							userId: ownerId,
						},
					},
				},
			],
			nextCursor: null,
		});
		expect(getUserSessionRequestsMock).toHaveBeenCalledWith(requesterId, input);
	});
});

describe("declineSessionRequest", () => {
	it("throws not found when the request does not exist", async () => {
		getSessionRequestMock.mockResolvedValue(null);

		await expect(
			sessionRequestService.declineSessionRequest(
				sessionId,
				requestId,
				ownerId,
			),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Session request not found.",
		});
		expect(getSessionByIdMock).not.toHaveBeenCalled();
	});

	it("throws not found when the session does not exist", async () => {
		getSessionRequestMock.mockResolvedValue(pendingRequest);
		getSessionByIdMock.mockResolvedValue(null);

		await expect(
			sessionRequestService.declineSessionRequest(
				sessionId,
				requestId,
				ownerId,
			),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Session not found.",
		});
	});

	it("prevents a non-owner from declining the request", async () => {
		getSessionRequestMock.mockResolvedValue(pendingRequest);
		getSessionByIdMock.mockResolvedValue(session);

		await expect(
			sessionRequestService.declineSessionRequest(
				sessionId,
				requestId,
				otherUserId,
			),
		).rejects.toMatchObject({
			name: "ForbiddenError",
			statusCode: 403,
			message: "Only the session owner can decline requests.",
		});
		expect(declineSessionRequestMock).not.toHaveBeenCalled();
	});

	it("prevents declining a request that is not pending", async () => {
		getSessionRequestMock.mockResolvedValue({
			...pendingRequest,
			status: "approved",
		});
		getSessionByIdMock.mockResolvedValue(session);

		await expect(
			sessionRequestService.declineSessionRequest(
				sessionId,
				requestId,
				ownerId,
			),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "Only pending requests can be declined.",
		});
		expect(declineSessionRequestMock).not.toHaveBeenCalled();
	});

	it("returns the declined request", async () => {
		const declinedRequest = {
			...pendingRequest,
			status: "declined" as const,
			respondedAt: new Date("2026-01-04T00:00:00.000Z"),
			updatedAt: new Date("2026-01-04T00:00:00.000Z"),
		};

		getSessionRequestMock.mockResolvedValue(pendingRequest);
		getSessionByIdMock.mockResolvedValue(session);
		declineSessionRequestMock.mockResolvedValue(declinedRequest);

		const result = await sessionRequestService.declineSessionRequest(
			sessionId,
			requestId,
			ownerId,
		);

		expect(result).toMatchObject({
			requestId,
			status: "declined",
			respondedAt: "2026-01-04T00:00:00.000Z",
		});
		expect(declineSessionRequestMock).toHaveBeenCalledWith(
			sessionId,
			requestId,
		);
	});

	it("detects when the request state changes before the decline update", async () => {
		getSessionRequestMock.mockResolvedValue(pendingRequest);
		getSessionByIdMock.mockResolvedValue(session);
		declineSessionRequestMock.mockResolvedValue(null);

		await expect(
			sessionRequestService.declineSessionRequest(
				sessionId,
				requestId,
				ownerId,
			),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "Request could not be declined because its state changed.",
		});
	});
});

describe("cancelSessionRequest", () => {
	it("throws not found when the request does not exist", async () => {
		getSessionRequestMock.mockResolvedValue(null);

		await expect(
			sessionRequestService.cancelSessionRequest(
				sessionId,
				requestId,
				requesterId,
			),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Session request not found.",
		});
	});

	it("prevents another user from cancelling the request", async () => {
		getSessionRequestMock.mockResolvedValue(pendingRequest);

		await expect(
			sessionRequestService.cancelSessionRequest(
				sessionId,
				requestId,
				otherUserId,
			),
		).rejects.toMatchObject({
			name: "ForbiddenError",
			statusCode: 403,
			message: "Only the requester can cancel this request.",
		});
		expect(cancelPendingSessionRequestMock).not.toHaveBeenCalled();
		expect(cancelApprovedBookingMock).not.toHaveBeenCalled();
	});

	it("cancels a pending request", async () => {
		const cancelledRequest = {
			...pendingRequest,
			status: "cancelled" as const,
			updatedAt: new Date("2026-01-04T00:00:00.000Z"),
		};

		getSessionRequestMock.mockResolvedValue(pendingRequest);
		cancelPendingSessionRequestMock.mockResolvedValue(cancelledRequest);

		const result = await sessionRequestService.cancelSessionRequest(
			sessionId,
			requestId,
			requesterId,
		);

		expect(result).toMatchObject({
			requestId,
			status: "cancelled",
			updatedAt: "2026-01-04T00:00:00.000Z",
		});
		expect(cancelPendingSessionRequestMock).toHaveBeenCalledWith(
			sessionId,
			requestId,
			requesterId,
		);
		expect(cancelApprovedBookingMock).not.toHaveBeenCalled();
	});

	it("detects when a pending request changes before cancellation", async () => {
		getSessionRequestMock.mockResolvedValue(pendingRequest);
		cancelPendingSessionRequestMock.mockResolvedValue(null);

		await expect(
			sessionRequestService.cancelSessionRequest(
				sessionId,
				requestId,
				requesterId,
			),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "Request could not be cancelled because its state changed.",
		});
	});

	it.each(["declined", "cancelled"] as const)(
		"prevents cancelling a %s request",
		async (status) => {
			getSessionRequestMock.mockResolvedValue({
				...pendingRequest,
				status,
			});

			await expect(
				sessionRequestService.cancelSessionRequest(
					sessionId,
					requestId,
					requesterId,
				),
			).rejects.toMatchObject({
				name: "ConflictError",
				statusCode: 409,
				message: "Only pending or approved requests can be cancelled.",
			});
		},
	);

	it("cancels an approved booking", async () => {
		const approvedRequest = {
			...pendingRequest,
			status: "approved" as const,
		};
		const cancelledRequest = {
			...approvedRequest,
			status: "cancelled" as const,
			updatedAt: new Date("2026-01-04T00:00:00.000Z"),
		};

		getSessionRequestMock.mockResolvedValue(approvedRequest);
		cancelApprovedBookingMock.mockResolvedValue({
			outcome: "cancelled",
			request: cancelledRequest,
		});

		const result = await sessionRequestService.cancelSessionRequest(
			sessionId,
			requestId,
			requesterId,
		);

		expect(result).toMatchObject({
			requestId,
			status: "cancelled",
		});
		expect(cancelApprovedBookingMock).toHaveBeenCalledWith(
			sessionId,
			requestId,
			requesterId,
		);
	});

	it.each([
		["session_not_found", "NotFoundError", 404, "Session not found."],
		["request_not_found", "NotFoundError", 404, "Session request not found."],
		[
			"forbidden",
			"ForbiddenError",
			403,
			"Only the requester can cancel this booking.",
		],
		[
			"request_not_approved",
			"ConflictError",
			409,
			"Request is no longer approved.",
		],
		[
			"session_not_booked",
			"ConflictError",
			409,
			"Session is no longer booked.",
		],
		[
			"session_started",
			"ConflictError",
			409,
			"Started sessions cannot be cancelled.",
		],
	] as const)(
		"translates the approved-booking %s outcome",
		async (outcome, errorName, statusCode, message) => {
			getSessionRequestMock.mockResolvedValue({
				...pendingRequest,
				status: "approved",
			});
			cancelApprovedBookingMock.mockResolvedValue({ outcome });

			await expect(
				sessionRequestService.cancelSessionRequest(
					sessionId,
					requestId,
					requesterId,
				),
			).rejects.toMatchObject({
				name: errorName,
				statusCode,
				message,
			});
		},
	);

	it("rejects an unexpected approved-booking cancellation outcome", async () => {
		getSessionRequestMock.mockResolvedValue({
			...pendingRequest,
			status: "approved",
		});
		cancelApprovedBookingMock.mockResolvedValue({
			outcome: "unexpected",
		} as never);

		await expect(
			sessionRequestService.cancelSessionRequest(
				sessionId,
				requestId,
				requesterId,
			),
		).rejects.toThrow(
			'Unhandled cancellation result: {"outcome":"unexpected"}',
		);
	});
});

describe("approveSessionRequest", () => {
	it("returns the approved request", async () => {
		const approvedRequest = {
			...pendingRequest,
			status: "approved" as const,
			respondedAt: new Date("2026-01-04T00:00:00.000Z"),
			updatedAt: new Date("2026-01-04T00:00:00.000Z"),
		};

		approveSessionRequestMock.mockResolvedValue({
			outcome: "approved",
			request: approvedRequest,
		});

		const result = await sessionRequestService.approveSessionRequest(
			sessionId,
			requestId,
			ownerId,
		);

		expect(result).toMatchObject({
			requestId,
			status: "approved",
			respondedAt: "2026-01-04T00:00:00.000Z",
		});
		expect(approveSessionRequestMock).toHaveBeenCalledWith(
			sessionId,
			requestId,
			ownerId,
		);
	});

	it.each([
		["session_not_found", "NotFoundError", 404, "Session not found."],
		[
			"forbidden",
			"ForbiddenError",
			403,
			"Only the session owner can approve requests.",
		],
		[
			"session_not_open",
			"ConflictError",
			409,
			"Only open sessions can approve requests.",
		],
		[
			"session_started",
			"ConflictError",
			409,
			"Past sessions cannot approve requests.",
		],
		["request_not_found", "NotFoundError", 404, "Session request not found."],
		[
			"request_not_pending",
			"ConflictError",
			409,
			"Only pending requests can be approved.",
		],
	] as const)(
		"translates the %s outcome",
		async (outcome, errorName, statusCode, message) => {
			approveSessionRequestMock.mockResolvedValue({ outcome });

			await expect(
				sessionRequestService.approveSessionRequest(
					sessionId,
					requestId,
					ownerId,
				),
			).rejects.toMatchObject({
				name: errorName,
				statusCode,
				message,
			});
		},
	);

	it("translates the approved-request unique constraint into a conflict", async () => {
		const uniqueViolation = Object.assign(new Error("Duplicate approval."), {
			code: "23505",
			constraint_name: "session_requests_one_approved_idx",
		});

		approveSessionRequestMock.mockRejectedValue(uniqueViolation);

		await expect(
			sessionRequestService.approveSessionRequest(
				sessionId,
				requestId,
				ownerId,
			),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "This session already has an approved requester.",
		});
	});

	it("preserves unexpected repository errors", async () => {
		const repositoryError = new Error("Database unavailable.");

		approveSessionRequestMock.mockRejectedValue(repositoryError);

		await expect(
			sessionRequestService.approveSessionRequest(
				sessionId,
				requestId,
				ownerId,
			),
		).rejects.toBe(repositoryError);
	});

	it("rejects an unexpected repository outcome", async () => {
		approveSessionRequestMock.mockResolvedValue({
			outcome: "unexpected",
		} as never);

		await expect(
			sessionRequestService.approveSessionRequest(
				sessionId,
				requestId,
				ownerId,
			),
		).rejects.toThrow('Unhandled approval result: {"outcome":"unexpected"}');
	});
});
