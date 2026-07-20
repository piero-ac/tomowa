import { type Request, type Response } from "express";
import {
	createSessionSchema,
	sessionIdSchema,
	updateSessionSchema,
} from "../validation/session.schema.js";
import { z } from "zod";
import * as sessionService from "../services/sessions.service.js";
import { BadRequestError, UnauthorizedError } from "../errors/index.js";


export async function getSessions(req: Request, res: Response) {
	const sessions = await sessionService.getSessions();

	res.status(200).json(sessions);
}

export async function getSessionById(req: Request, res: Response) {
	const result = sessionIdSchema.safeParse(req.params);

	if (!result.success) {
		throw new BadRequestError(
			"Validation failed.",
			z.flattenError(result.error),
		);
	}

	const session = await sessionService.getSessionById(result.data.sessionId);

	res.status(200).json(session);
}

export async function createSession(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const result = createSessionSchema.safeParse(req.body);

	if (!result.success) {
		throw new BadRequestError(
			"Validation failed.",
			z.flattenError(result.error),
		);
	}

	const createdSession = await sessionService.createSession({
		...result.data,
		organizerId: req.user.id,
	});

	res.status(201).json(createdSession);
}

export async function updateSession(req: Request, res: Response) {
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

	const bodyResult = updateSessionSchema.safeParse(req.body);

	if (!bodyResult.success) {
		const errors = z.flattenError(bodyResult.error);
		throw new BadRequestError(
			"Validation failed.",
			errors,
		);
	}

	const updatedSession = await sessionService.updateSession(
		paramsResult.data.sessionId,
		req.user.id,
		bodyResult.data,
	);

	res.status(200).json(updatedSession);
}

export async function deleteSession(req: Request, res: Response) {
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

	await sessionService.deleteSession(
		paramsResult.data.sessionId,
		req.user.id,
	);

	res.status(204).send();
}
