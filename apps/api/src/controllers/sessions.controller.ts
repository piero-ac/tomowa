import { type Request, type Response } from "express";
import {
	createSessionSchema,
	sessionIdSchema,
	updateSessionSchema,
} from "../validation/session.schema.js";
import { z } from "zod";
import * as sessionService from "../services/sessions.service.js";

const TEMPORARY_ORGANIZER_ID = "11111111-1111-1111-1111-111111111111";

export async function getSessions(req: Request, res: Response) {
	const sessions = await sessionService.getSessions();

	res.status(200).json(sessions);
}

export async function getSessionById(req: Request, res: Response) {
	const result = sessionIdSchema.safeParse(req.params);

	if (!result.success) {
		res.status(400).json({
			message: "Invalid session ID",
		});
		return;
	}

	const session = await sessionService.getSessionById(result.data.sessionId);

	res.status(200).json(session);
}

export async function createSession(req: Request, res: Response) {
	const result = createSessionSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({
			message: "Validation failed",
			errors: z.flattenError(result.error),
		});

		return;
	}

	const createdSession = await sessionService.createSession({
		...result.data,
		organizerId: TEMPORARY_ORGANIZER_ID,
	});

	res.status(201).json(createdSession);
}

export async function updateSession(req: Request, res: Response) {
	const paramsResult = sessionIdSchema.safeParse(req.params);

	if (!paramsResult.success) {
		res.status(400).json({
			message: "Invalid session ID",
		});
		return;
	}

	const bodyResult = updateSessionSchema.safeParse(req.body);

	if (!bodyResult.success) {
		const errors = z.flattenError(bodyResult.error);

		res.status(400).json({
			message: "Validation failed",
			errors,
		});
		return;
	}

	const updatedSession = await sessionService.updateSession(
		paramsResult.data.sessionId,
		bodyResult.data,
	);

	res.status(200).json(updatedSession);
}

export async function deleteSession(req: Request, res: Response) {
	const paramsResult = sessionIdSchema.safeParse(req.params);

	if (!paramsResult.success) {
		res.status(400).json({
			message: "Invalid session ID",
		});
		return;
	}

	// TODO: get organizerId from user object in req object
	//  const organizerId = req.user.id;

	await sessionService.deleteSession(
		paramsResult.data.sessionId,
		TEMPORARY_ORGANIZER_ID,
	);

	res.status(204).send();
}
