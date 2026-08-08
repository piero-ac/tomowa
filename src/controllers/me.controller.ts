import type { Request, Response } from "express";
import { z } from "zod";
import { BadRequestError, UnauthorizedError } from "../errors/index.js";
import { updateProfileSchema } from "../validation/profile.schema.js";
import * as sessionService from "../services/sessions.service.js";
import * as sessionRequestService from "../services/session-requests.service.js";
import * as profileService from "../services/profiles.service.js";
import { decodeCursor } from "../lib/pagination.js";
import { paginationQuerySchema } from "../validation/pagination.schema.js";

export async function getCreatedSessions(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const queryResult = paginationQuerySchema.safeParse(req.query);

	if (!queryResult.success) {
		throw new BadRequestError(
			"Invalid query parameters.",
			z.flattenError(queryResult.error),
		);
	}

	const page = await sessionService.getOwnedSessions(req.user.id, {
		limit: queryResult.data.limit,
		...(queryResult.data.cursor
			? {
					cursor: decodeCursor(queryResult.data.cursor),
				}
			: {}),
	});

	res.status(200).json(page);
}

export async function getUserSessionRequests(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const queryResult = paginationQuerySchema.safeParse(req.query);

	if (!queryResult.success) {
		throw new BadRequestError(
			"Invalid query parameters.",
			z.flattenError(queryResult.error),
		);
	}

	const page = await sessionRequestService.getUserSessionRequests(req.user.id, {
		limit: queryResult.data.limit,
		...(queryResult.data.cursor
			? {
					cursor: decodeCursor(queryResult.data.cursor),
				}
			: {}),
	});

	res.status(200).json(page);
}

export async function getBookedSessions(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const queryResult = paginationQuerySchema.safeParse(req.query);

	if (!queryResult.success) {
		throw new BadRequestError(
			"Invalid query parameters.",
			z.flattenError(queryResult.error),
		);
	}

	const page = await sessionService.getBookedSessionsForUser(req.user.id, {
		limit: queryResult.data.limit,
		...(queryResult.data.cursor
			? {
					cursor: decodeCursor(queryResult.data.cursor),
				}
			: {}),
	});

	res.status(200).json(page);
}

export async function getProfile(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const profile = await profileService.getUserProfile(req.user.id);

	res.status(200).json(profile);
}

export async function updateProfile(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const result = updateProfileSchema.safeParse(req.body);

	if (!result.success) {
		throw new BadRequestError(
			"Validation failed.",
			z.flattenError(result.error),
		);
	}

	const profile = await profileService.updateUserProfile(
		req.user.id,
		result.data,
	);

	res.status(200).json(profile);
}
