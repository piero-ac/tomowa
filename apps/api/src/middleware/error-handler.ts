import type {
	ErrorRequestHandler,
} from "express";
import { AppError } from "../errors/AppError.js";

export const errorHandler: ErrorRequestHandler = (
	error,
	req,
	res,
	next,
) => {
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