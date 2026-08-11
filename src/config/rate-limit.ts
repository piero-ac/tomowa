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

export function createDemoLoginRateLimiter() {
	return rateLimit({
		windowMs: 15 * 60_000,
		limit: 10,
		identifier: "demo-login",
		standardHeaders: "draft-8",
		legacyHeaders: false,
		message: {
			message: "Too many demo login attempts. Please try again later.",
		},
	});
}
