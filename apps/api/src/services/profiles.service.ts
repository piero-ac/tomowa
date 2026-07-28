import { NotFoundError } from "../errors/index.js";
import { toProfileDto } from "../mappers/profile.mapper.js";
import * as profileRepository from "../repositories/profiles.repository.js";

export async function getUserProfile(userId: string) {
	const profile = await profileRepository.getProfileByUserId(userId);

	if (!profile) {
		throw new NotFoundError("Profile not found.");
	}

	return toProfileDto(profile);
}
