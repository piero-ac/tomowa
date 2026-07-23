import type { Request, Response } from "express";
import { z } from "zod";

import { BadRequestError, UnauthorizedError } from "../errors/index.js";
import * as sessionRequestService from "../services/session-requests.service.js";
import { sessionIdSchema } from "../validation/session.schema.js";
import {
	createSessionRequestSchema,
	sessionRequestParamsSchema,
} from "../validation/session-request.schema.js";

export async function createSessionRequest(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const paramsResult = sessionIdSchema.safeParse(req.params);

	if (!paramsResult.success) {
		throw new BadRequestError(
			"Invalid session ID.",
			z.flattenError(paramsResult.error),
		);
	}

	const bodyResult = createSessionRequestSchema.safeParse(req.body);

	if (!bodyResult.success) {
		throw new BadRequestError(
			"Validation failed.",
			z.flattenError(bodyResult.error),
		);
	}

	const createdRequest = await sessionRequestService.createSessionRequest({
		sessionId: paramsResult.data.sessionId,
		requesterId: req.user.id,
		message: bodyResult.data.message,
	});

	res.status(201).json(createdRequest);
}

export async function declineSessionRequest(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const paramsResult = sessionRequestParamsSchema.safeParse(req.params);

	if (!paramsResult.success) {
		throw new BadRequestError(
			"Invalid session or request ID.",
			z.flattenError(paramsResult.error),
		);
	}

	const declinedRequest = await sessionRequestService.declineSessionRequest(
		paramsResult.data.sessionId,
		paramsResult.data.requestId,
		req.user.id,
	);

	res.status(200).json(declinedRequest);
}

export async function cancelSessionRequest(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const paramsResult = sessionRequestParamsSchema.safeParse(req.params);

	if (!paramsResult.success) {
		throw new BadRequestError(
			"Invalid session or request ID.",
			z.flattenError(paramsResult.error),
		);
	}

	const cancelledRequest = await sessionRequestService.cancelSessionRequest(
		paramsResult.data.sessionId,
		paramsResult.data.requestId,
		req.user.id,
	);

	res.status(200).json(cancelledRequest);
}
