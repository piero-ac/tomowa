import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { profiles } from "../db/schema.js";
import type { UpdateProfileInput } from "../types/profile.js";

export async function getProfileByUserId(userId: string) {
	const [profile] = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, userId))
		.limit(1);

	return profile ?? null;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
	const [updatedProfile] = await db
		.update(profiles)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(eq(profiles.id, userId))
		.returning();

	return updatedProfile ?? null;
}
