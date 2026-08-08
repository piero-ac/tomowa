import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import type { SelectProfile, SelectSession } from "../../../src/db/schema.js";
import { decodeCursor } from "../../../src/lib/pagination.js";
import * as sessionRepository from "../../../src/repositories/sessions.repository.js";
import * as sessionService from "../../../src/services/sessions.service.js";
import type { CreateSessionInput } from "../../../src/types/session.js";

vi.mock("../../../src/repositories/sessions.repository.js", () => ({
	getSessions: vi.fn(),
	getOwnedSessions: vi.fn(),
	getBookedSessionsForUser: vi.fn(),
	getSessionWithOwnerById: vi.fn(),
	isApprovedRequester: vi.fn(),
	createSession: vi.fn(),
	getSessionById: vi.fn(),
	updateSession: vi.fn(),
	deleteOrCancelSession: vi.fn(),
}));

const ownerId = "10000000-0000-4000-8000-000000000001";
const otherUserId = "10000000-0000-4000-8000-000000000002";
const unrelatedUserId = "10000000-0000-4000-8000-000000000003";
const sessionId = "20000000-0000-4000-8000-000000000001";
const secondSessionId = "20000000-0000-4000-8000-000000000002";

const validCreateInput: CreateSessionInput = {
	ownerId,
	title: "Japanese Conversation",
	targetLanguage: "Japanese",
	helpLanguage: "English",
	startsAt: new Date("2030-01-15T18:00:00.000Z"),
	durationMinutes: 30,
	meetingLink: "https://example.test/meeting",
	imageKey: null,
	description: "Practice everyday conversation.",
};

const existingSession: SelectSession = {
	id: sessionId,
	...validCreateInput,
	status: "open",
	imageKey: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const publicSession: Omit<SelectSession, "meetingLink"> = {
	id: existingSession.id,
	ownerId: existingSession.ownerId,
	title: existingSession.title,
	targetLanguage: existingSession.targetLanguage,
	helpLanguage: existingSession.helpLanguage,
	startsAt: existingSession.startsAt,
	durationMinutes: existingSession.durationMinutes,
	status: existingSession.status,
	imageKey: existingSession.imageKey,
	description: existingSession.description,
	createdAt: existingSession.createdAt,
	updatedAt: existingSession.updatedAt,
};

const ownerProfile: SelectProfile = {
	id: ownerId,
	displayName: "Session Owner",
	username: "session_owner",
	bio: null,
	avatarKey: null,
	nativeLanguage: "English",
	learningLanguage: "Japanese",
	timezone: "America/New_York",
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const getSessionsMock = vi.mocked(sessionRepository.getSessions);
const getOwnedSessionsMock = vi.mocked(sessionRepository.getOwnedSessions);
const getBookedSessionsForUserMock = vi.mocked(
	sessionRepository.getBookedSessionsForUser,
);
const getSessionWithOwnerByIdMock = vi.mocked(
	sessionRepository.getSessionWithOwnerById,
);
const isApprovedRequesterMock = vi.mocked(
	sessionRepository.isApprovedRequester,
);
const createSessionMock = vi.mocked(sessionRepository.createSession);
const getSessionByIdMock = vi.mocked(sessionRepository.getSessionById);
const updateSessionMock = vi.mocked(sessionRepository.updateSession);
const deleteOrCancelSessionMock = vi.mocked(
	sessionRepository.deleteOrCancelSession,
);

beforeAll(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-30T12:00:00.000Z"));
});

beforeEach(() => {
	vi.resetAllMocks();
});

afterAll(() => {
	vi.useRealTimers();
});

describe("session reads", () => {
	it("maps and paginates public sessions without exposing meeting links", async () => {
		const input = { limit: 1 };
		const secondSession = {
			...publicSession,
			id: secondSessionId,
			startsAt: new Date("2030-01-16T18:00:00.000Z"),
		};

		getSessionsMock.mockResolvedValue([
			{
				session: publicSession,
				owner: ownerProfile,
			},
			{
				session: secondSession,
				owner: ownerProfile,
			},
		]);

		const page = await sessionService.getSessions(input);

		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({
			sessionId,
			ownerId,
			owner: {
				userId: ownerId,
				displayName: "Session Owner",
			},
		});
		expect(page.items[0]).not.toHaveProperty("meetingLink");
		expect(page.nextCursor).toEqual(expect.any(String));

		if (!page.nextCursor) {
			throw new Error("Expected a next cursor.");
		}

		expect(decodeCursor(page.nextCursor)).toEqual({
			sortValue: publicSession.startsAt,
			id: sessionId,
		});
		expect(getSessionsMock).toHaveBeenCalledWith(input);
	});

	it("maps owned sessions with meeting links and request summaries", async () => {
		const input = { limit: 20 };

		getOwnedSessionsMock.mockResolvedValue([
			{
				session: existingSession,
				owner: ownerProfile,
				pendingRequestCount: 2,
				approvedRequestCount: 1,
				declinedRequestCount: 3,
				cancelledRequestCount: 4,
				totalRequestCount: 10,
			},
		]);

		const page = await sessionService.getOwnedSessions(ownerId, input);

		expect(page).toMatchObject({
			items: [
				{
					sessionId,
					meetingLink: "https://example.test/meeting",
					requestSummary: {
						pending: 2,
						approved: 1,
						declined: 3,
						cancelled: 4,
						total: 10,
					},
				},
			],
			nextCursor: null,
		});
		expect(getOwnedSessionsMock).toHaveBeenCalledWith(ownerId, input);
	});

	it("maps booked sessions with their meeting links", async () => {
		const input = { limit: 20 };

		getBookedSessionsForUserMock.mockResolvedValue([
			{
				session: {
					...existingSession,
					status: "booked",
				},
				owner: ownerProfile,
			},
		]);

		const page = await sessionService.getBookedSessionsForUser(
			otherUserId,
			input,
		);

		expect(page).toMatchObject({
			items: [
				{
					sessionId,
					status: "booked",
					meetingLink: "https://example.test/meeting",
				},
			],
			nextCursor: null,
		});
		expect(getBookedSessionsForUserMock).toHaveBeenCalledWith(
			otherUserId,
			input,
		);
	});
});

describe("getSessionById", () => {
	it("throws not found when the session does not exist", async () => {
		getSessionWithOwnerByIdMock.mockResolvedValue(null);

		await expect(
			sessionService.getSessionById(sessionId, otherUserId),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Session not found.",
		});
		expect(isApprovedRequesterMock).not.toHaveBeenCalled();
	});

	it("shows the meeting link to the session owner", async () => {
		getSessionWithOwnerByIdMock.mockResolvedValue({
			session: existingSession,
			owner: ownerProfile,
		});

		const result = await sessionService.getSessionById(sessionId, ownerId);

		expect(result.meetingLink).toBe("https://example.test/meeting");
		expect(isApprovedRequesterMock).not.toHaveBeenCalled();
	});

	it("shows the meeting link to the approved requester", async () => {
		getSessionWithOwnerByIdMock.mockResolvedValue({
			session: existingSession,
			owner: ownerProfile,
		});
		isApprovedRequesterMock.mockResolvedValue(true);

		const result = await sessionService.getSessionById(sessionId, otherUserId);

		expect(result.meetingLink).toBe("https://example.test/meeting");
		expect(isApprovedRequesterMock).toHaveBeenCalledWith(
			sessionId,
			otherUserId,
		);
	});

	it("hides the meeting link from an unrelated user", async () => {
		getSessionWithOwnerByIdMock.mockResolvedValue({
			session: existingSession,
			owner: ownerProfile,
		});
		isApprovedRequesterMock.mockResolvedValue(false);

		const result = await sessionService.getSessionById(
			sessionId,
			unrelatedUserId,
		);

		expect(result).not.toHaveProperty("meetingLink");
		expect(isApprovedRequesterMock).toHaveBeenCalledWith(
			sessionId,
			unrelatedUserId,
		);
	});
});

describe("createSession", () => {
	it("rejects a session that does not start in the future", async () => {
		const input = {
			...validCreateInput,
			startsAt: new Date(Date.now() - 60_000),
		};

		await expect(sessionService.createSession(input)).rejects.toMatchObject({
			name: "BadRequestError",
			statusCode: 400,
			message: "Session must start in the future.",
		});
		expect(createSessionMock).not.toHaveBeenCalled();
	});

	it("returns the created session ID", async () => {
		createSessionMock.mockResolvedValue({ sessionId });

		const result = await sessionService.createSession(validCreateInput);

		expect(result).toEqual({ sessionId });
		expect(createSessionMock).toHaveBeenCalledOnce();
		expect(createSessionMock).toHaveBeenCalledWith(validCreateInput);
	});

	it("throws when the repository does not return the created session", async () => {
		createSessionMock.mockResolvedValue(null);

		await expect(
			sessionService.createSession(validCreateInput),
		).rejects.toThrow("Session could not be created.");
	});

	it("translates a duplicate active start time into a conflict", async () => {
		const uniqueViolation = Object.assign(
			new Error("Duplicate active session."),
			{
				code: "23505",
				constraint_name: "sessions_owner_active_start_unique_idx",
			},
		);

		createSessionMock.mockRejectedValue(uniqueViolation);

		await expect(
			sessionService.createSession(validCreateInput),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "You already have an active session at this start time.",
		});
	});

	it("preserves unexpected repository errors", async () => {
		const repositoryError = new Error("Database unavailable.");

		createSessionMock.mockRejectedValue(repositoryError);

		await expect(sessionService.createSession(validCreateInput)).rejects.toBe(
			repositoryError,
		);
	});
});

describe("updateSession", () => {
	it("throws not found when the session does not exist", async () => {
		getSessionByIdMock.mockResolvedValue(null);

		await expect(
			sessionService.updateSession(sessionId, ownerId, {
				title: "Updated title",
			}),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Session not found.",
		});
		expect(updateSessionMock).not.toHaveBeenCalled();
	});

	it("prevents a non-owner from updating the session", async () => {
		getSessionByIdMock.mockResolvedValue(existingSession);

		await expect(
			sessionService.updateSession(sessionId, otherUserId, {
				title: "Unauthorized update",
			}),
		).rejects.toMatchObject({
			name: "ForbiddenError",
			statusCode: 403,
			message: "Update not allowed.",
		});
		expect(updateSessionMock).not.toHaveBeenCalled();
	});

	it.each(["cancelled", "completed"] as const)(
		"prevents updating a %s session",
		async (status) => {
			getSessionByIdMock.mockResolvedValue({
				...existingSession,
				status,
			});

			await expect(
				sessionService.updateSession(sessionId, ownerId, {
					title: "Updated title",
				}),
			).rejects.toMatchObject({
				name: "ConflictError",
				statusCode: 409,
				message: "Cancelled or completed sessions cannot be updated.",
			});
			expect(updateSessionMock).not.toHaveBeenCalled();
		},
	);

	it("prevents changing the start time of a booked session", async () => {
		getSessionByIdMock.mockResolvedValue({
			...existingSession,
			status: "booked",
		});

		await expect(
			sessionService.updateSession(sessionId, ownerId, {
				startsAt: new Date("2030-01-16T18:00:00.000Z"),
			}),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "A booked session's start time cannot be changed.",
		});
		expect(updateSessionMock).not.toHaveBeenCalled();
	});

	it("rejects a start time that is not in the future", async () => {
		getSessionByIdMock.mockResolvedValue(existingSession);

		await expect(
			sessionService.updateSession(sessionId, ownerId, {
				startsAt: new Date(Date.now() - 60_000),
			}),
		).rejects.toMatchObject({
			name: "BadRequestError",
			statusCode: 400,
			message: "Session must start in the future.",
		});
		expect(updateSessionMock).not.toHaveBeenCalled();
	});

	it("allows a booked session to update fields other than its start time", async () => {
		const bookedSession = {
			...existingSession,
			status: "booked" as const,
		};
		const input = {
			title: "Updated booked session",
		};
		const updatedSession = {
			...bookedSession,
			...input,
			updatedAt: new Date("2026-01-03T00:00:00.000Z"),
		};

		getSessionByIdMock.mockResolvedValue(bookedSession);
		updateSessionMock.mockResolvedValue(updatedSession);

		const result = await sessionService.updateSession(
			sessionId,
			ownerId,
			input,
		);

		expect(result).toMatchObject({
			sessionId,
			ownerId,
			title: "Updated booked session",
			status: "booked",
			meetingLink: "https://example.test/meeting",
			updatedAt: "2026-01-03T00:00:00.000Z",
		});
		expect(updateSessionMock).toHaveBeenCalledOnce();
		expect(updateSessionMock).toHaveBeenCalledWith(sessionId, ownerId, input);
	});

	it("throws when the repository does not return the updated session", async () => {
		getSessionByIdMock.mockResolvedValue(existingSession);
		updateSessionMock.mockResolvedValue(null);

		await expect(
			sessionService.updateSession(sessionId, ownerId, {
				title: "Updated title",
			}),
		).rejects.toThrow("Session could not be updated.");
	});

	it("translates a duplicate active start time into a conflict", async () => {
		const uniqueViolation = Object.assign(
			new Error("Duplicate active session."),
			{
				code: "23505",
				constraint_name: "sessions_owner_active_start_unique_idx",
			},
		);

		getSessionByIdMock.mockResolvedValue(existingSession);
		updateSessionMock.mockRejectedValue(uniqueViolation);

		await expect(
			sessionService.updateSession(sessionId, ownerId, {
				startsAt: new Date("2030-01-16T18:00:00.000Z"),
			}),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "You already have an active session at this start time.",
		});
	});

	it("preserves unexpected repository errors", async () => {
		const repositoryError = new Error("Database unavailable.");

		getSessionByIdMock.mockResolvedValue(existingSession);
		updateSessionMock.mockRejectedValue(repositoryError);

		await expect(
			sessionService.updateSession(sessionId, ownerId, {
				title: "Updated title",
			}),
		).rejects.toBe(repositoryError);
	});
});

describe("deleteSession", () => {
	it.each(["deleted", "cancelled"] as const)(
		"completes successfully when the repository outcome is %s",
		async (outcome) => {
			deleteOrCancelSessionMock.mockResolvedValue({ outcome });

			await expect(
				sessionService.deleteSession(sessionId, ownerId),
			).resolves.toBeUndefined();
			expect(deleteOrCancelSessionMock).toHaveBeenCalledOnce();
			expect(deleteOrCancelSessionMock).toHaveBeenCalledWith(
				sessionId,
				ownerId,
			);
		},
	);

	it("throws not found when the session does not exist", async () => {
		deleteOrCancelSessionMock.mockResolvedValue({
			outcome: "session_not_found",
		});

		await expect(
			sessionService.deleteSession(sessionId, ownerId),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Session not found.",
		});
	});

	it("prevents a non-owner from deleting or cancelling the session", async () => {
		deleteOrCancelSessionMock.mockResolvedValue({
			outcome: "forbidden",
		});

		await expect(
			sessionService.deleteSession(sessionId, otherUserId),
		).rejects.toMatchObject({
			name: "ForbiddenError",
			statusCode: 403,
			message: "Only the session owner can delete or cancel it.",
		});
	});

	it("prevents cancelling a session that has started", async () => {
		deleteOrCancelSessionMock.mockResolvedValue({
			outcome: "session_started",
		});

		await expect(
			sessionService.deleteSession(sessionId, ownerId),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "Started sessions cannot be cancelled.",
		});
	});

	it("prevents cancelling a completed or cancelled session", async () => {
		deleteOrCancelSessionMock.mockResolvedValue({
			outcome: "session_not_cancellable",
		});

		await expect(
			sessionService.deleteSession(sessionId, ownerId),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "Completed or cancelled sessions cannot be cancelled.",
		});
	});

	it("rejects an unexpected repository outcome", async () => {
		deleteOrCancelSessionMock.mockResolvedValue({
			outcome: "unexpected",
		} as never);

		await expect(
			sessionService.deleteSession(sessionId, ownerId),
		).rejects.toThrow(
			'Unhandled session cancellation result: {"outcome":"unexpected"}',
		);
	});
});
