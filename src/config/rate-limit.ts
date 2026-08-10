import { rateLimit } from "express-rate-limit";

interface ApiRateLimiterOptions {
	windowMs: number;
	limit: number;
}

export function createApiRateLimiter(options: ApiRateLimiterOptions) {
	return rateLimit({
		windowMs: options.windowMs,
		limit: options.limit,
		identifier: "api",
		standardHeaders: "draft-8",
		legacyHeaders: false,
		message: {
			message: "Too many requests. Please try again later.",
		},
	});
}
