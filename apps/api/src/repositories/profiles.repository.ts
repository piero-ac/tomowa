import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { profiles } from "../db/schema.js";

export async function getProfileByUserId(userId: string) {
	const [profile] = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, userId))
		.limit(1);

	return profile ?? null;
}
