import type { SelectSessionRequest } from "../db/schema.js";

export type SessionRequestStatus = SelectSessionRequest["status"];

export interface SessionRequestDto {
	requestId: string;
	sessionId: string;
	requesterId: string;
	status: SessionRequestStatus;
	message: string | null;
	createdAt: string;
	respondedAt: string | null;
	updatedAt: string;
}

export interface CreateSessionRequestInput {
	sessionId: string;
	requesterId: string;
	message?: string | null;
}
