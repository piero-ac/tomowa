import type { SelectSessionRequest } from "../db/schema.js";
import type { SessionWithOwnerDto } from "./session.js";
import type { PublicProfileSummaryDto } from "./profile.js";

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

export interface SessionRequestWithRequesterDto extends SessionRequestDto {
	requester: PublicProfileSummaryDto;
}

export interface UserSessionRequestDto extends SessionRequestDto {
	session: SessionWithOwnerDto;
}

export interface CreateSessionRequestInput {
	sessionId: string;
	requesterId: string;
	message?: string | null;
}
