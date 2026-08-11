import { describe, expect, it } from "vitest";

import {
	buildDemoBaseline,
	type DemoUserIds,
} from "../../../src/demo/demo-baseline.js";

const now = new Date("2026-08-11T12:00:00.000Z");
const userIds: DemoUserIds = {
	owner: "10000000-0000-4000-8000-000000000001",
	requester: "10000000-0000-4000-8000-000000000002",
	other: "10000000-0000-4000-8000-000000000003",
};

describe("buildDemoBaseline", () => {
	it("creates the expected number of deterministic records", () => {
		const firstBaseline = buildDemoBaseline(userIds, now);
		const secondBaseline = buildDemoBaseline(userIds, now);

		expect(firstBaseline).toEqual(secondBaseline);
		expect(firstBaseline.profiles).toHaveLength(3);
		expect(firstBaseline.sessions).toHaveLength(4);
		expect(firstBaseline.requests).toHaveLength(5);
		expect(
			new Set(firstBaseline.sessions.map((session) => session.id)).size,
		).toBe(4);
		expect(
			new Set(firstBaseline.requests.map((request) => request.id)).size,
		).toBe(5);
	});

	it("places every session safely in the future", () => {
		const baseline = buildDemoBaseline(userIds, now);

		for (const session of baseline.sessions) {
			expect(session.startsAt.getTime()).toBeGreaterThan(now.getTime());
		}
	});

	it("creates a booked session with exactly one approved request", () => {
		const baseline = buildDemoBaseline(userIds, now);
		const bookedSession = baseline.sessions.find(
			(session) => session.status === "booked",
		);
		const approvedRequests = baseline.requests.filter(
			(request) => request.status === "approved",
		);

		expect(bookedSession).toBeDefined();
		expect(approvedRequests).toHaveLength(1);
		expect(approvedRequests[0]?.sessionId).toBe(bookedSession?.id);
		expect(approvedRequests[0]?.requesterId).toBe(userIds.requester);
	});

	it("creates an open session with two pending choices", () => {
		const baseline = buildDemoBaseline(userIds, now);
		const approvalSession = baseline.sessions.find(
			(session) => session.title === "Choose a Language Practice Partner",
		);
		const pendingRequests = baseline.requests.filter(
			(request) =>
				request.sessionId === approvalSession?.id &&
				request.status === "pending",
		);

		expect(approvalSession?.status).toBe("open");
		expect(pendingRequests).toHaveLength(2);
		expect(pendingRequests.map((request) => request.requesterId)).toEqual([
			userIds.requester,
			userIds.other,
		]);
	});
});
