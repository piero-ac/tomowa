import type { Request, Response } from "express";

import { UnauthorizedError } from "../errors/index.js";
import * as sessionService from "../services/sessions.service.js";
import * as sessionRequestService from "../services/session-requests.service.js";

export async function getCreatedSessions(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const sessions = await sessionService.getOwnedSessions(req.user.id);

	res.status(200).json(sessions);
}

export async function getUserSessionRequests(req: Request, res: Response) {
	if (!req.user) {
		throw new UnauthorizedError();
	}

	const requests = await sessionRequestService.getUserSessionRequests(
		req.user.id,
	);

	res.status(200).json(requests);
}
