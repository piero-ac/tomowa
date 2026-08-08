import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/AppError.js";

type RequestBodyError = Error & {
	status?: number;
	type?: string;
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
	if (res.headersSent) {
		next(error);
		return;
	}

	const requestBodyError = error as RequestBodyError;

	if (requestBodyError.type === "entity.parse.failed") {
		res.status(400).json({
			message: "Malformed JSON.",
		});
		return;
	}

	if (requestBodyError.type === "entity.too.large") {
		res.status(413).json({
			message: "Request body is too large.",
		});
		return;
	}

	if (error instanceof AppError) {
		res.status(error.statusCode).json({
			message: error.message,
			...(error.errors !== undefined && { errors: error.errors }),
		});

		return;
	}

	res.status(500).json({
		message: "Internal server error.",
	});
};
