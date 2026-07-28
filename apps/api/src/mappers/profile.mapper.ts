import type { SelectProfile } from "../db/schema.js";
import type { ProfileDto, PublicProfileSummaryDto } from "../types/profile.js";

export function toProfileDto(profile: SelectProfile): ProfileDto {
	return {
		userId: profile.id,
		displayName: profile.displayName,
		username: profile.username,
		bio: profile.bio,
		avatarKey: profile.avatarKey,
		nativeLanguage: profile.nativeLanguage,
		learningLanguage: profile.learningLanguage,
		timezone: profile.timezone,
		createdAt: profile.createdAt.toISOString(),
		updatedAt: profile.updatedAt.toISOString(),
	};
}

export function toPublicProfileSummaryDto(
	profile: SelectProfile,
): PublicProfileSummaryDto {
	return {
		userId: profile.id,
		displayName: profile.displayName,
		username: profile.username,
		avatarKey: profile.avatarKey,
		nativeLanguage: profile.nativeLanguage,
		learningLanguage: profile.learningLanguage,
	};
}
