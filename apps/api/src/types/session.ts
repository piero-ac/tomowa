import type { InsertSession } from "../db/schema.js";

export type CreateSessionInput = Pick<
	InsertSession,
	| "organizerId"
	| "title"
	| "targetLanguage"
	| "helpLanguage"
	| "startsAt"
	| "capacity"
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
		| "capacity"
		| "meetingLink"
		| "imageKey"
		| "description"
	>
>;
