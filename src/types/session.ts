import type { InsertSession, SelectSession } from "../db/schema.js";
import type { PublicProfileSummaryDto } from "./profile.js";

export interface CreateSessionResponseDto {
	sessionId: string;
}

export type SessionStatus = SelectSession["status"];

export interface SessionDto {
	sessionId: string;
	ownerId: string;
	title: string;
	targetLanguage: string;
	helpLanguage: string;
	startsAt: string;
	durationMinutes: number;
	status: SessionStatus;
	imageKey: string | null;
	description: string;
	createdAt: string;
	updatedAt: string;
	meetingLink?: string;
}

export interface SessionWithOwnerDto extends SessionDto {
	owner: PublicProfileSummaryDto;
}

export type CreateSessionInput = Pick<
	InsertSession,
	| "ownerId"
	| "title"
	| "targetLanguage"
	| "helpLanguage"
	| "startsAt"
	| "durationMinutes"
	| "meetingLink"
	| "imageKey"
	| "description"
>;

export type UpdateSessionInput = Partial<
	Pick<
		InsertSession,
		| "title"
		| "targetLanguage"
		| "helpLanguage"
		| "startsAt"
		| "durationMinutes"
		| "meetingLink"
		| "imageKey"
		| "description"
	>
>;

export interface SessionRequestSummaryDto {
	pending: number;
	approved: number;
	declined: number;
	cancelled: number;
	total: number;
}

export interface OwnedSessionDto extends SessionWithOwnerDto {
	meetingLink: string;
	requestSummary: SessionRequestSummaryDto;
}

export interface BookedSessionDto extends SessionWithOwnerDto {
	meetingLink: string;
}
