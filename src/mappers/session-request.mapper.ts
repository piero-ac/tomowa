import type {
	SelectProfile,
	SelectSession,
	SelectSessionRequest,
} from "../db/schema.js";
import type {
	SessionRequestDto,
	SessionRequestWithRequesterDto,
	UserSessionRequestDto,
} from "../types/session-request.js";
import { toSessionWithOwnerDto } from "./session.mapper.js";
import { toPublicProfileSummaryDto } from "./profile.mapper.js";

interface UserSessionRequestDtoSource {
	request: SelectSessionRequest;
	session: SelectSession;
	owner: SelectProfile;
}

interface SessionRequestWithRequesterDtoSource {
	request: SelectSessionRequest;
	requester: SelectProfile;
}

export function toSessionRequestDto(
	request: SelectSessionRequest,
): SessionRequestDto {
	return {
		requestId: request.id,
		sessionId: request.sessionId,
		requesterId: request.requesterId,
		status: request.status,
		message: request.message,
		createdAt: request.createdAt.toISOString(),
		respondedAt: request.respondedAt?.toISOString() ?? null,
		updatedAt: request.updatedAt.toISOString(),
	};
}

export function toUserSessionRequestDto(
	source: UserSessionRequestDtoSource,
): UserSessionRequestDto {
	return {
		...toSessionRequestDto(source.request),
		session: toSessionWithOwnerDto(
			{
				session: source.session,
				owner: source.owner,
			},
			source.request.status === "approved",
		),
	};
}

export function toSessionRequestWithRequesterDto(
	source: SessionRequestWithRequesterDtoSource,
): SessionRequestWithRequesterDto {
	return {
		...toSessionRequestDto(source.request),
		requester: toPublicProfileSummaryDto(source.requester),
	};
}
