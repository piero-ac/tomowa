import type { SelectSessionRequest } from "../db/schema.js";
import type { SessionRequestDto } from "../types/session-request.js";

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
