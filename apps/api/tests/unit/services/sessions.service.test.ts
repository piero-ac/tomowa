import { beforeEach, describe, expect, it, vi } from "vitest";

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

const createSessionMock = vi.mocked(sessionRepository.createSession);

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
