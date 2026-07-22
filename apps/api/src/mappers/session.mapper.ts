import type { SelectSession } from "../db/schema.js";
import type { SessionDto } from "../types/session.js";

interface SessionDtoSource extends Omit<SelectSession, "meetingLink"> {
	meetingLink?: string;
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
