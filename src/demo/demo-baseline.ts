import type { InsertSession, InsertSessionRequest } from "../db/schema.js";

export const demoUserEmails = {
	owner: "owner@example.test",
	requester: "requester@example.test",
	other: "other@example.test",
} as const;

export interface DemoUserIds {
	owner: string;
	requester: string;
	other: string;
}

export interface DemoProfileBaseline {
	id: string;
	displayName: string;
	username: string;
	bio: string;
	avatarKey: null;
	nativeLanguage: string;
	learningLanguage: string;
	timezone: string;
	updatedAt: Date;
}

export interface DemoBaseline {
	profiles: DemoProfileBaseline[];
	sessions: InsertSession[];
	requests: InsertSessionRequest[];
}

const sessionIds = {
	open: "20000000-0000-4000-8000-000000000001",
	pendingRequests: "20000000-0000-4000-8000-000000000002",
	booked: "20000000-0000-4000-8000-000000000003",
	requesterOwned: "20000000-0000-4000-8000-000000000004",
} as const;

const requestIds = {
	pendingRequester: "30000000-0000-4000-8000-000000000001",
	pendingOther: "30000000-0000-4000-8000-000000000002",
	approvedRequester: "30000000-0000-4000-8000-000000000003",
	declinedOther: "30000000-0000-4000-8000-000000000004",
	requesterOwnedPending: "30000000-0000-4000-8000-000000000005",
} as const;

function dateAtUtcHourAfterDays(now: Date, days: number, hour: number) {
	const date = new Date(now);

	date.setUTCDate(date.getUTCDate() + days);
	date.setUTCHours(hour, 0, 0, 0);

	return date;
}

function dateBeforeHours(now: Date, hours: number) {
	return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function buildDemoBaseline(
	userIds: DemoUserIds,
	now = new Date(),
): DemoBaseline {
	const createdAt = dateBeforeHours(now, 24);
	const respondedAt = dateBeforeHours(now, 12);

	return {
		profiles: [
			{
				id: userIds.owner,
				displayName: "Demo Owner",
				username: "tomowa_demo_owner",
				bio: "Hosting language-exchange sessions and practicing Japanese.",
				avatarKey: null,
				nativeLanguage: "English",
				learningLanguage: "Japanese",
				timezone: "America/New_York",
				updatedAt: now,
			},
			{
				id: userIds.requester,
				displayName: "Demo Requester",
				username: "tomowa_demo_requester",
				bio: "Looking for English conversation partners.",
				avatarKey: null,
				nativeLanguage: "Japanese",
				learningLanguage: "English",
				timezone: "Asia/Tokyo",
				updatedAt: now,
			},
			{
				id: userIds.other,
				displayName: "Demo Observer",
				username: "tomowa_demo_observer",
				bio: "A third account for testing authorization and privacy.",
				avatarKey: null,
				nativeLanguage: "Spanish",
				learningLanguage: "Japanese",
				timezone: "Europe/Madrid",
				updatedAt: now,
			},
		],
		sessions: [
			{
				id: sessionIds.open,
				ownerId: userIds.owner,
				title: "Japanese Conversation for Beginners",
				targetLanguage: "Japanese",
				helpLanguage: "English",
				startsAt: dateAtUtcHourAfterDays(now, 2, 18),
				durationMinutes: 30,
				status: "open",
				meetingLink: "https://example.test/meet/demo-open",
				imageKey: null,
				description:
					"An open session with no requests yet. Try requesting it as another user.",
				createdAt,
				updatedAt: now,
			},
			{
				id: sessionIds.pendingRequests,
				ownerId: userIds.owner,
				title: "Choose a Language Practice Partner",
				targetLanguage: "Japanese",
				helpLanguage: "English",
				startsAt: dateAtUtcHourAfterDays(now, 3, 19),
				durationMinutes: 45,
				status: "open",
				meetingLink: "https://example.test/meet/demo-approval",
				imageKey: null,
				description:
					"Two users have pending requests. Approving one declines the other.",
				createdAt,
				updatedAt: now,
			},
			{
				id: sessionIds.booked,
				ownerId: userIds.owner,
				title: "Booked Japanese Conversation",
				targetLanguage: "Japanese",
				helpLanguage: "English",
				startsAt: dateAtUtcHourAfterDays(now, 4, 17),
				durationMinutes: 60,
				status: "booked",
				meetingLink: "https://example.test/meet/demo-booked",
				imageKey: null,
				description:
					"A booked session for demonstrating meeting-link privacy and cancellation.",
				createdAt,
				updatedAt: now,
			},
			{
				id: sessionIds.requesterOwned,
				ownerId: userIds.requester,
				title: "English Conversation Exchange",
				targetLanguage: "English",
				helpLanguage: "Japanese",
				startsAt: dateAtUtcHourAfterDays(now, 5, 20),
				durationMinutes: 30,
				status: "open",
				meetingLink: "https://example.test/meet/demo-requester-owned",
				imageKey: null,
				description:
					"The requester persona also owns this session and can manage its pending request.",
				createdAt,
				updatedAt: now,
			},
		],
		requests: [
			{
				id: requestIds.pendingRequester,
				sessionId: sessionIds.pendingRequests,
				requesterId: userIds.requester,
				status: "pending",
				message: "I would love to practice English and help with Japanese.",
				createdAt,
				respondedAt: null,
				updatedAt: createdAt,
			},
			{
				id: requestIds.pendingOther,
				sessionId: sessionIds.pendingRequests,
				requesterId: userIds.other,
				status: "pending",
				message: "I can help with conversational Spanish too.",
				createdAt: dateBeforeHours(now, 20),
				respondedAt: null,
				updatedAt: dateBeforeHours(now, 20),
			},
			{
				id: requestIds.approvedRequester,
				sessionId: sessionIds.booked,
				requesterId: userIds.requester,
				status: "approved",
				message: "Looking forward to our conversation.",
				createdAt,
				respondedAt,
				updatedAt: respondedAt,
			},
			{
				id: requestIds.declinedOther,
				sessionId: sessionIds.booked,
				requesterId: userIds.other,
				status: "declined",
				message: "Happy to join if there is room.",
				createdAt: dateBeforeHours(now, 20),
				respondedAt,
				updatedAt: respondedAt,
			},
			{
				id: requestIds.requesterOwnedPending,
				sessionId: sessionIds.requesterOwned,
				requesterId: userIds.other,
				status: "pending",
				message: "I would like to practice English together.",
				createdAt,
				respondedAt: null,
				updatedAt: createdAt,
			},
		],
	};
}
