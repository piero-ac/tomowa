import type { Request, Response } from "express";

import { UnauthorizedError } from "../errors/index.js";
import * as sessionService from "../services/sessions.service.js";

export async function getCreatedSessions(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const sessions = await sessionService.getOwnedSessions(req.user.id);

	res.status(200).json(sessions);
}
