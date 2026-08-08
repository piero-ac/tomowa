import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/index.js";
import { supabase } from "../lib/supabase.js";

export async function requireAuth(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const authorization = req.headers.authorization;

	if (!authorization) {
		throw new UnauthorizedError();
	}

	const [scheme, token, extra] = authorization.trim().split(/\s+/);

	if (scheme?.toLowerCase() !== "bearer" || !token || extra !== undefined) {
		throw new UnauthorizedError();
	}

	const { data, error } = await supabase.auth.getClaims(token);

	if (
		error ||
		!data?.claims ||
		typeof data.claims.sub !== "string" ||
		!data.claims.sub ||
		data.claims.role !== "authenticated"
	) {
		throw new UnauthorizedError();
	}

	req.user = {
		id: data.claims.sub,
	};

	next();
}
