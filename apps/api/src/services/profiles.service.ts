import { isPostgresUniqueViolation } from "../db/postgres-error.js";
import { ConflictError, NotFoundError } from "../errors/index.js";
import { toProfileDto } from "../mappers/profile.mapper.js";
import * as profileRepository from "../repositories/profiles.repository.js";
import type { UpdateProfileInput } from "../types/profile.js";

export async function getUserProfile(userId: string) {
	const profile = await profileRepository.getProfileByUserId(userId);

	if (!profile) {
		throw new NotFoundError("Profile not found.");
	}

	return toProfileDto(profile);
}

export async function updateUserProfile(
	userId: string,
	input: UpdateProfileInput,
) {
	try {
		const profile = await profileRepository.updateProfile(userId, input);

		if (!profile) {
			throw new NotFoundError("Profile not found.");
		}

		return toProfileDto(profile);
	} catch (error) {
		if (isPostgresUniqueViolation(error, "profiles_username_key")) {
			throw new ConflictError("Username is already in use.");
		}

		throw error;
	}
}
