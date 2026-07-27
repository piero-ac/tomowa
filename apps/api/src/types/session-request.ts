import type { SelectSessionRequest } from "../db/schema.js";
import type { SessionDto } from "./session.js";

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

export interface UserSessionRequestDto extends SessionRequestDto {
	session: SessionDto;
}

export interface CreateSessionRequestInput {
	sessionId: string;
	requesterId: string;
	message?: string | null;
}
