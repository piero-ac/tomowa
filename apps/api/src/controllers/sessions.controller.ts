import { type Request, type Response } from "express";
import * as sessionService from "../services/sessions.service.js";

export async function getSessions(req: Request, res: Response) {
	const sessions = await sessionService.getSessions();

	res.status(200).json(sessions);
}
