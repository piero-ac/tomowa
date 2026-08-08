import type { SelectProfile, SelectSession } from "../db/schema.js";
import type {
	BookedSessionDto,
	OwnedSessionDto,
	SessionDto,
	SessionWithOwnerDto,
} from "../types/session.js";
import { toPublicProfileSummaryDto } from "./profile.mapper.js";

interface SessionDtoSource extends Omit<SelectSession, "meetingLink"> {
	meetingLink?: string;
}

interface SessionWithOwnerDtoSource {
	session: SessionDtoSource;
	owner: SelectProfile;
}

interface FullSessionWithOwnerDtoSource {
	session: SelectSession;
	owner: SelectProfile;
}

interface OwnedSessionDtoSource extends FullSessionWithOwnerDtoSource {
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

export function toSessionWithOwnerDto(
	source: SessionWithOwnerDtoSource,
	includeMeetingLink = false,
): SessionWithOwnerDto {
	return {
		...toSessionDto(source.session, includeMeetingLink),
		owner: toPublicProfileSummaryDto(source.owner),
	};
}

export function toOwnedSessionDto(
	source: OwnedSessionDtoSource,
): OwnedSessionDto {
	return {
		...toSessionWithOwnerDto(source, true),
		meetingLink: source.session.meetingLink,
		requestSummary: {
			pending: source.pendingRequestCount,
			approved: source.approvedRequestCount,
			declined: source.declinedRequestCount,
			cancelled: source.cancelledRequestCount,
			total: source.totalRequestCount,
		},
	};
}

export function toBookedSessionDto(
	source: FullSessionWithOwnerDtoSource,
): BookedSessionDto {
	return {
		...toSessionWithOwnerDto(source, true),
		meetingLink: source.session.meetingLink,
	};
}
