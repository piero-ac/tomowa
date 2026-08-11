import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";
import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { db } from "../../src/db/index.js";
import { profiles, sessionRequests, sessions } from "../../src/db/schema.js";
import { buildDemoBaseline } from "../../src/demo/demo-baseline.js";
import { resetDemoData } from "../../src/demo/reset-demo-data.js";
import { getAccessToken } from "../helpers/auth.js";

const execFileAsync = promisify(execFile);
const fixedNow = new Date("2026-08-11T12:00:00.000Z");
const outsiderEmail = "demo-reset-outsider@example.test";
const outsiderSessionId = "40000000-0000-4000-8000-000000000001";
const changedSessionId = "40000000-0000-4000-8000-000000000002";
const crossRequestId = "40000000-0000-4000-8000-000000000003";

let outsiderUserId: string | undefined;
let userIds: {
	owner: string;
	requester: string;
	other: string;
};

function requireTestVariable(name: string) {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} is required for the demo reset test.`);
	}

	return value;
}

const supabaseAdmin = createClient(
	requireTestVariable("SUPABASE_URL"),
	requireTestVariable("SUPABASE_LOCAL_SECRET_KEY"),
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	},
);

async function getUserId(
	email: "owner@example.test" | "requester@example.test" | "other@example.test",
) {
	const token = await getAccessToken(email);
	const response = await request(app)
		.get("/api/me/profile")
		.set("Authorization", `Bearer ${token}`);

	if (response.status !== 200 || typeof response.body.userId !== "string") {
		throw new Error(`Could not resolve seeded user ${email}.`);
	}

	return response.body.userId as string;
}

beforeAll(async () => {
	const [ownerId, requesterId, otherId] = await Promise.all([
		getUserId("owner@example.test"),
		getUserId("requester@example.test"),
		getUserId("other@example.test"),
	]);

	userIds = {
		owner: ownerId,
		requester: requesterId,
		other: otherId,
	};

	const { data: existingUsers, error: listUsersError } =
		await supabaseAdmin.auth.admin.listUsers({
			page: 1,
			perPage: 1000,
		});

	if (listUsersError) {
		throw listUsersError;
	}

	const existingOutsider = existingUsers.users.find(
		(user) => user.email === outsiderEmail,
	);

	if (existingOutsider) {
		await db
			.delete(sessionRequests)
			.where(eq(sessionRequests.requesterId, existingOutsider.id));
		await db.delete(sessions).where(eq(sessions.ownerId, existingOutsider.id));
		await supabaseAdmin.auth.admin.deleteUser(existingOutsider.id);
	}

	const { data, error } = await supabaseAdmin.auth.admin.createUser({
		email: outsiderEmail,
		password: requireTestVariable("LOCAL_SEED_PASSWORD"),
		email_confirm: true,
		user_metadata: {
			display_name: "Reset Outsider",
		},
	});

	if (error) {
		throw error;
	}

	outsiderUserId = data.user.id;

	await db.insert(sessions).values({
		id: outsiderSessionId,
		ownerId: outsiderUserId,
		title: "Unrelated Session",
		targetLanguage: "French",
		helpLanguage: "English",
		startsAt: new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000),
		durationMinutes: 30,
		status: "open",
		meetingLink: "https://example.test/meet/unrelated",
		imageKey: null,
		description: "This session must survive the demo reset.",
	});
});

afterAll(async () => {
	if (outsiderUserId) {
		await db
			.delete(sessionRequests)
			.where(eq(sessionRequests.requesterId, outsiderUserId));
		await db.delete(sessions).where(eq(sessions.ownerId, outsiderUserId));
		await supabaseAdmin.auth.admin.deleteUser(outsiderUserId);
	}

	await execFileAsync("npm", ["run", "db:seed"], {
		cwd: process.cwd(),
	});
});

describe("resetDemoData", () => {
	it("replaces demo data, preserves Auth users, and is repeatable", async () => {
		await db
			.update(profiles)
			.set({
				displayName: "Changed by a tester",
				username: "changed_demo_owner",
			})
			.where(eq(profiles.id, userIds.owner));

		await db.insert(sessions).values({
			id: changedSessionId,
			ownerId: userIds.other,
			title: "Tester-created Session",
			targetLanguage: "Japanese",
			helpLanguage: "Spanish",
			startsAt: new Date(fixedNow.getTime() + 8 * 24 * 60 * 60 * 1000),
			durationMinutes: 30,
			status: "open",
			meetingLink: "https://example.test/meet/tester-created",
			imageKey: null,
			description: "This demo-owned session should be replaced.",
		});

		const demoUserIds = Object.values(userIds);
		const sessionsBeforeReset = await db
			.select({ id: sessions.id })
			.from(sessions)
			.where(inArray(sessions.ownerId, demoUserIds));
		const sessionIdsBeforeReset = sessionsBeforeReset.map(
			(session) => session.id,
		);
		const requestsBeforeReset =
			sessionIdsBeforeReset.length === 0
				? []
				: await db
						.select({ id: sessionRequests.id })
						.from(sessionRequests)
						.where(inArray(sessionRequests.sessionId, sessionIdsBeforeReset));

		const firstResult = await resetDemoData(db, fixedNow);
		const expectedBaseline = buildDemoBaseline(userIds, fixedNow);

		expect(firstResult).toEqual({
			profilesUpdated: 3,
			sessionsDeleted: sessionsBeforeReset.length,
			requestsDeleted: requestsBeforeReset.length,
			sessionsCreated: 4,
			requestsCreated: 5,
		});

		const resetProfiles = await db
			.select()
			.from(profiles)
			.where(inArray(profiles.id, demoUserIds));
		const resetSessions = await db
			.select()
			.from(sessions)
			.where(inArray(sessions.ownerId, demoUserIds));
		const resetSessionIds = resetSessions.map((session) => session.id);
		const resetRequests = await db
			.select()
			.from(sessionRequests)
			.where(inArray(sessionRequests.sessionId, resetSessionIds));
		const [unrelatedSession] = await db
			.select({ id: sessions.id })
			.from(sessions)
			.where(eq(sessions.id, outsiderSessionId));

		expect(resetProfiles).toEqual(
			expect.arrayContaining(
				expectedBaseline.profiles.map((profile) =>
					expect.objectContaining(profile),
				),
			),
		);
		expect(resetSessions).toHaveLength(4);
		expect(resetRequests).toHaveLength(5);
		expect(unrelatedSession?.id).toBe(outsiderSessionId);

		for (const userId of demoUserIds) {
			const { data, error } =
				await supabaseAdmin.auth.admin.getUserById(userId);

			expect(error).toBeNull();
			expect(data.user?.id).toBe(userId);
		}

		const secondResult = await resetDemoData(db, fixedNow);

		expect(secondResult).toEqual({
			profilesUpdated: 3,
			sessionsDeleted: 4,
			requestsDeleted: 5,
			sessionsCreated: 4,
			requestsCreated: 5,
		});
	});

	it("aborts rather than modifying a non-demo user's relationship", async () => {
		await db.insert(sessionRequests).values({
			id: crossRequestId,
			sessionId: outsiderSessionId,
			requesterId: userIds.owner,
			status: "pending",
			message: "This relationship crosses the demo boundary.",
		});

		await expect(resetDemoData(db, fixedNow)).rejects.toThrow(
			"Demo data is connected to a non-demo user; reset aborted.",
		);

		const [crossRequest] = await db
			.select({ id: sessionRequests.id })
			.from(sessionRequests)
			.where(
				and(
					eq(sessionRequests.id, crossRequestId),
					eq(sessionRequests.sessionId, outsiderSessionId),
				),
			);
		const demoSessions = await db
			.select({ id: sessions.id })
			.from(sessions)
			.where(inArray(sessions.ownerId, Object.values(userIds)));

		expect(crossRequest?.id).toBe(crossRequestId);
		expect(demoSessions).toHaveLength(4);

		await db
			.delete(sessionRequests)
			.where(eq(sessionRequests.id, crossRequestId));
	});
});
