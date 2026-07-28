import type { InsertProfile } from "../db/schema.js";

export interface ProfileDto {
	userId: string;
	displayName: string | null;
	username: string | null;
	bio: string | null;
	avatarKey: string | null;
	nativeLanguage: string | null;
	learningLanguage: string | null;
	timezone: string | null;
	createdAt: string;
	updatedAt: string;
}

export type UpdateProfileInput = Partial<
	Pick<
		InsertProfile,
		| "displayName"
		| "username"
		| "bio"
		| "nativeLanguage"
		| "learningLanguage"
		| "timezone"
	>
>;
