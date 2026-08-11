import type { Request, Response } from "express";
import { z } from "zod";

import { BadRequestError } from "../errors/index.js";
import * as demoAuthService from "../services/demo-auth.service.js";
import { demoLoginSchema } from "../validation/demo-login.schema.js";

export async function loginDemoUser(req: Request, res: Response) {
	const result = demoLoginSchema.safeParse(req.body);

	if (!result.success) {
		throw new BadRequestError(
			"Validation failed.",
			z.flattenError(result.error),
		);
	}

	const response = await demoAuthService.loginDemoUser(result.data.role);

	res.set("Cache-Control", "no-store");
	res.status(200).json(response);
}
