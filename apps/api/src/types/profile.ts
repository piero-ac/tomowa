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
