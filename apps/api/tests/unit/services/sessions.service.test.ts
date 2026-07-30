import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectSession } from "../../../src/db/schema.js";
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
const sessionId = "20000000-0000-4000-8000-000000000001";

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

const createSessionMock = vi.mocked(sessionRepository.createSession);
const getSessionByIdMock = vi.mocked(sessionRepository.getSessionById);
const updateSessionMock = vi.mocked(sessionRepository.updateSession);

beforeEach(() => {
	vi.resetAllMocks();
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
