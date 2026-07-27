import type { SelectSession, SelectSessionRequest } from "../db/schema.js";
import type {
	SessionRequestDto,
	UserSessionRequestDto,
} from "../types/session-request.js";
import { toSessionDto } from "./session.mapper.js";

interface UserSessionRequestDtoSource {
	request: SelectSessionRequest;
	session: SelectSession;
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
		session: toSessionDto(source.session, source.request.status === "approved"),
	};
}
