import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectProfile } from "../../../src/db/schema.js";
import * as profileRepository from "../../../src/repositories/profiles.repository.js";
import * as profileService from "../../../src/services/profiles.service.js";

vi.mock("../../../src/repositories/profiles.repository.js", () => ({
	getProfileByUserId: vi.fn(),
	updateProfile: vi.fn(),
}));

const userId = "10000000-0000-4000-8000-000000000001";

const profile: SelectProfile = {
	id: userId,
	displayName: "Session Owner",
	username: "session_owner",
	bio: "Learning Japanese.",
	avatarKey: null,
	nativeLanguage: "English",
	learningLanguage: "Japanese",
	timezone: "America/New_York",
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const getProfileByUserIdMock = vi.mocked(profileRepository.getProfileByUserId);
const updateProfileMock = vi.mocked(profileRepository.updateProfile);

beforeEach(() => {
	vi.resetAllMocks();
});

describe("getUserProfile", () => {
	it("returns a mapped profile", async () => {
		getProfileByUserIdMock.mockResolvedValue(profile);

		const result = await profileService.getUserProfile(userId);

		expect(result).toEqual({
			userId,
			displayName: "Session Owner",
			username: "session_owner",
			bio: "Learning Japanese.",
			avatarKey: null,
			nativeLanguage: "English",
			learningLanguage: "Japanese",
			timezone: "America/New_York",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-02T00:00:00.000Z",
		});
		expect(getProfileByUserIdMock).toHaveBeenCalledOnce();
		expect(getProfileByUserIdMock).toHaveBeenCalledWith(userId);
	});

	it("throws not found when the profile does not exist", async () => {
		getProfileByUserIdMock.mockResolvedValue(null);

		await expect(profileService.getUserProfile(userId)).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Profile not found.",
		});
	});

	it("preserves unexpected repository errors", async () => {
		const repositoryError = new Error("Database unavailable.");

		getProfileByUserIdMock.mockRejectedValue(repositoryError);

		await expect(profileService.getUserProfile(userId)).rejects.toBe(
			repositoryError,
		);
	});
});

describe("updateUserProfile", () => {
	const input = {
		displayName: "Updated Owner",
		username: "updated_owner",
	};

	it("updates and returns a mapped profile", async () => {
		const updatedProfile = {
			...profile,
			...input,
			updatedAt: new Date("2026-01-03T00:00:00.000Z"),
		};

		updateProfileMock.mockResolvedValue(updatedProfile);

		const result = await profileService.updateUserProfile(userId, input);

		expect(result).toMatchObject({
			userId,
			displayName: "Updated Owner",
			username: "updated_owner",
			updatedAt: "2026-01-03T00:00:00.000Z",
		});
		expect(updateProfileMock).toHaveBeenCalledOnce();
		expect(updateProfileMock).toHaveBeenCalledWith(userId, input);
	});

	it("throws not found when the profile does not exist", async () => {
		updateProfileMock.mockResolvedValue(null);

		await expect(
			profileService.updateUserProfile(userId, input),
		).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Profile not found.",
		});
	});

	it("translates a duplicate username violation into a conflict", async () => {
		const uniqueViolation = Object.assign(new Error("Duplicate username."), {
			code: "23505",
			constraint_name: "profiles_username_key",
		});

		updateProfileMock.mockRejectedValue(uniqueViolation);

		await expect(
			profileService.updateUserProfile(userId, input),
		).rejects.toMatchObject({
			name: "ConflictError",
			statusCode: 409,
			message: "Username is already in use.",
		});
	});

	it("preserves unexpected repository errors", async () => {
		const repositoryError = new Error("Database unavailable.");

		updateProfileMock.mockRejectedValue(repositoryError);

		await expect(profileService.updateUserProfile(userId, input)).rejects.toBe(
			repositoryError,
		);
	});
});
