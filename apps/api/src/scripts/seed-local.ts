import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import { sessions } from "../db/schema.js";

const seedEnvSchema = z.object({
	DATABASE_URL: z.url(),
	SUPABASE_URL: z.url(),
	SUPABASE_LOCAL_SECRET_KEY: z.string().trim().min(1),
	LOCAL_SEED_PASSWORD: z.string().min(8),
});

const result = seedEnvSchema.safeParse(process.env);

if (!result.success) {
	console.error("Invalid seed configuration:", z.flattenError(result.error));
	process.exit(1);
}

const seedEnv = result.data;

function assertLocalUrl(value: string, name: string) {
	const hostname = new URL(value).hostname;

	if (hostname !== "localhost" && hostname !== "127.0.0.1") {
		throw new Error(`${name} must point to localhost.`);
	}
}

assertLocalUrl(seedEnv.DATABASE_URL, "DATABASE_URL");
assertLocalUrl(seedEnv.SUPABASE_URL, "SUPABASE_URL");

const databaseClient = postgres(seedEnv.DATABASE_URL, {
	max: 1,
});

const db = drizzle({
	client: databaseClient,
});

const supabaseAdmin = createClient(
	seedEnv.SUPABASE_URL,
	seedEnv.SUPABASE_LOCAL_SECRET_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	},
);

const seedUsers = [
	{
		email: "owner@example.test",
		displayName: "Session Owner",
	},
	{
		email: "requester@example.test",
		displayName: "Session Requester",
	},
	{
		email: "other@example.test",
		displayName: "Other User",
	},
] as const;

const seededSessionIds = [
	"10000000-0000-4000-8000-000000000001",
	"10000000-0000-4000-8000-000000000002",
];

async function seed() {
	const { data: existingUsersData, error: listUsersError } =
		await supabaseAdmin.auth.admin.listUsers({
			page: 1,
			perPage: 1000,
		});

	if (listUsersError) {
		throw listUsersError;
	}

	const existingUsers = new Map(
		existingUsersData.users.map((user) => [user.email, user]),
	);

	const userIds = new Map<string, string>();

	for (const seedUser of seedUsers) {
		const existingUser = existingUsers.get(seedUser.email);

		if (existingUser) {
			const { error } = await supabaseAdmin.auth.admin.updateUserById(
				existingUser.id,
				{
					password: seedEnv.LOCAL_SEED_PASSWORD,
					email_confirm: true,
					user_metadata: {
						display_name: seedUser.displayName,
					},
				},
			);

			if (error) {
				throw error;
			}

			userIds.set(seedUser.email, existingUser.id);
			continue;
		}

		const { data, error } = await supabaseAdmin.auth.admin.createUser({
			email: seedUser.email,
			password: seedEnv.LOCAL_SEED_PASSWORD,
			email_confirm: true,
			user_metadata: {
				display_name: seedUser.displayName,
			},
		});

		if (error) {
			throw error;
		}

		userIds.set(seedUser.email, data.user.id);
	}

	const ownerId = userIds.get("owner@example.test");

	if (!ownerId) {
		throw new Error("Seed owner was not created.");
	}

	await db.delete(sessions).where(eq(sessions.ownerId, ownerId));

	const now = Date.now();

	await db.insert(sessions).values([
		{
			id: seededSessionIds[0],
			ownerId,
			title: "Japanese Conversation Practice",
			targetLanguage: "Japanese",
			helpLanguage: "English",
			startsAt: new Date(now + 24 * 60 * 60 * 1000),
			durationMinutes: 30,
			status: "open",
			meetingLink: "https://example.test/meeting/japanese",
			imageKey: null,
			description: "Practice conversational Japanese together.",
		},
		{
			id: seededSessionIds[1],
			ownerId,
			title: "Spanish Speaking Practice",
			targetLanguage: "Spanish",
			helpLanguage: "English",
			startsAt: new Date(now + 48 * 60 * 60 * 1000),
			durationMinutes: 45,
			status: "open",
			meetingLink: "https://example.test/meeting/spanish",
			imageKey: null,
			description: "A relaxed Spanish conversation session.",
		},
	]);

	console.log("Local database seeded successfully.");
	console.log(`Users: ${seedUsers.map((user) => user.email).join(", ")}`);
}

try {
	await seed();
} finally {
	await databaseClient.end();
}
