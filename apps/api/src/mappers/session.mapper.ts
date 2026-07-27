import type { SelectSession } from "../db/schema.js";
import type {
	BookedSessionDto,
	OwnedSessionDto,
	SessionDto,
} from "../types/session.js";

interface SessionDtoSource extends Omit<SelectSession, "meetingLink"> {
	meetingLink?: string;
}

interface OwnedSessionDtoSource extends SelectSession {
	pendingRequestCount: number;
	approvedRequestCount: number;
	declinedRequestCount: number;
	cancelledRequestCount: number;
	totalRequestCount: number;
}

export function toSessionDto(
	session: SessionDtoSource,
	includeMeetingLink = false,
): SessionDto {
	return {
		sessionId: session.id,
		ownerId: session.ownerId,
		title: session.title,
		targetLanguage: session.targetLanguage,
		helpLanguage: session.helpLanguage,
		startsAt: session.startsAt.toISOString(),
		durationMinutes: session.durationMinutes,
		status: session.status,
		imageKey: session.imageKey,
		description: session.description,
		createdAt: session.createdAt.toISOString(),
		updatedAt: session.updatedAt.toISOString(),
		...(includeMeetingLink && session.meetingLink
			? { meetingLink: session.meetingLink }
			: {}),
	};
}

export function toOwnedSessionDto(
	session: OwnedSessionDtoSource,
): OwnedSessionDto {
	return {
		...toSessionDto(session, true),
		meetingLink: session.meetingLink,
		requestSummary: {
			pending: session.pendingRequestCount,
			approved: session.approvedRequestCount,
			declined: session.declinedRequestCount,
			cancelled: session.cancelledRequestCount,
			total: session.totalRequestCount,
		},
	};
}

export function toBookedSessionDto(session: SelectSession): BookedSessionDto {
	return {
		...toSessionDto(session, true),
		meetingLink: session.meetingLink,
	};
}
