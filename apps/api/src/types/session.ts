import type { InsertSession } from "../db/schema.js";

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
