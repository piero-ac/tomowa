import type { Request, Response } from "express";
import { z } from "zod";

import { BadRequestError, UnauthorizedError } from "../errors/index.js";
import * as sessionRequestService from "../services/session-requests.service.js";
import { sessionIdSchema } from "../validation/session.schema.js";
import {
	createSessionRequestSchema,
	sessionRequestParamsSchema,
} from "../validation/session-request.schema.js";
import { decodeCursor } from "../lib/pagination.js";
import { paginationQuerySchema } from "../validation/pagination.schema.js";

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

export async function getSessionRequests(req: Request, res: Response) {
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

	const queryResult = paginationQuerySchema.safeParse(req.query);

	if (!queryResult.success) {
		throw new BadRequestError(
			"Invalid query parameters.",
			z.flattenError(queryResult.error),
		);
	}

	const page = await sessionRequestService.getSessionRequests(
		paramsResult.data.sessionId,
		req.user.id,
		{
			limit: queryResult.data.limit,
			...(queryResult.data.cursor
				? {
						cursor: decodeCursor(queryResult.data.cursor),
					}
				: {}),
		},
	);

	res.status(200).json(page);
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

export async function approveSessionRequest(req: Request, res: Response) {
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

	const approvedRequest = await sessionRequestService.approveSessionRequest(
		paramsResult.data.sessionId,
		paramsResult.data.requestId,
		req.user.id,
	);

	res.status(200).json(approvedRequest);
}
