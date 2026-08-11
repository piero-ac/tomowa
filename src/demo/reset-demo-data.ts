import { and, eq, inArray, notInArray, or } from "drizzle-orm";
import { pgSchema, text, uuid } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { profiles, sessionRequests, sessions } from "../db/schema.js";
import {
	buildDemoBaseline,
	demoUserEmails,
	type DemoUserIds,
} from "./demo-baseline.js";

const auth = pgSchema("auth");
const authUsers = auth.table("users", {
	id: uuid("id").primaryKey(),
	email: text("email"),
});

export interface DemoResetResult {
	profilesUpdated: number;
	sessionsDeleted: number;
	requestsDeleted: number;
	sessionsCreated: number;
	requestsCreated: number;
}

function resolveDemoUserIds(
	rows: { id: string; email: string | null }[],
): DemoUserIds {
	const idsByEmail = new Map(rows.map((row) => [row.email, row.id]));
	const missingEmails = Object.values(demoUserEmails).filter(
		(email) => !idsByEmail.has(email),
	);

	if (missingEmails.length > 0) {
		throw new Error(`Demo Auth users are missing: ${missingEmails.join(", ")}`);
	}

	return {
		owner: idsByEmail.get(demoUserEmails.owner)!,
		requester: idsByEmail.get(demoUserEmails.requester)!,
		other: idsByEmail.get(demoUserEmails.other)!,
	};
}

export async function resetDemoData(
	database: PostgresJsDatabase,
	now = new Date(),
): Promise<DemoResetResult> {
	return database.transaction(
		async (tx) => {
			const authUserRows = await tx
				.select({
					id: authUsers.id,
					email: authUsers.email,
				})
				.from(authUsers)
				.where(inArray(authUsers.email, Object.values(demoUserEmails)));

			const userIds = resolveDemoUserIds(authUserRows);
			const demoUserIds = Object.values(userIds);
			const baseline = buildDemoBaseline(userIds, now);
			const [externalRelationship] = await tx
				.select({ id: sessionRequests.id })
				.from(sessionRequests)
				.innerJoin(sessions, eq(sessions.id, sessionRequests.sessionId))
				.where(
					or(
						and(
							inArray(sessions.ownerId, demoUserIds),
							notInArray(sessionRequests.requesterId, demoUserIds),
						),
						and(
							notInArray(sessions.ownerId, demoUserIds),
							inArray(sessionRequests.requesterId, demoUserIds),
						),
					),
				)
				.limit(1);

			if (externalRelationship) {
				throw new Error(
					"Demo data is connected to a non-demo user; reset aborted.",
				);
			}

			const existingSessions = await tx
				.select({ id: sessions.id })
				.from(sessions)
				.where(inArray(sessions.ownerId, demoUserIds));

			const existingSessionIds = existingSessions.map((session) => session.id);
			let deletedRequests: { id: string }[] = [];

			if (existingSessionIds.length > 0) {
				deletedRequests = await tx
					.delete(sessionRequests)
					.where(inArray(sessionRequests.sessionId, existingSessionIds))
					.returning({ id: sessionRequests.id });
			}

			const deletedSessions = await tx
				.delete(sessions)
				.where(inArray(sessions.ownerId, demoUserIds))
				.returning({ id: sessions.id });

			let profilesUpdated = 0;

			await tx
				.update(profiles)
				.set({ username: null })
				.where(inArray(profiles.id, demoUserIds));

			for (const profile of baseline.profiles) {
				const { id, ...values } = profile;
				const updatedProfiles = await tx
					.update(profiles)
					.set(values)
					.where(eq(profiles.id, id))
					.returning({ id: profiles.id });

				if (updatedProfiles.length !== 1) {
					throw new Error(`Demo profile is missing for user ${id}.`);
				}

				profilesUpdated += 1;
			}

			const createdSessions = await tx
				.insert(sessions)
				.values(baseline.sessions)
				.returning({ id: sessions.id });

			const createdRequests = await tx
				.insert(sessionRequests)
				.values(baseline.requests)
				.returning({ id: sessionRequests.id });

			return {
				profilesUpdated,
				sessionsDeleted: deletedSessions.length,
				requestsDeleted: deletedRequests.length,
				sessionsCreated: createdSessions.length,
				requestsCreated: createdRequests.length,
			};
		},
		{
			isolationLevel: "serializable",
		},
	);
}
