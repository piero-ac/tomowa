import type { InsertSession, SelectSession } from "../db/schema.js";

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
