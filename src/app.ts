import cors from "cors";
import express from "express";
import helmet from "helmet";

import { createCorsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { createApiRateLimiter } from "./config/rate-limit.js";
import apiRouter from "./routes/index.js";
import healthRouter from "./routes/health.routes.js";
import docsRouter, { getOpenApiDocument } from "./routes/docs.routes.js";

import { errorHandler } from "./middleware/error-handler.js";
import { logErrors } from "./middleware/log-errors.js";
import { notFoundHandler } from "./middleware/not-found.js";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(
	"/docs",
	helmet({
		contentSecurityPolicy: false,
	}),
	docsRouter,
);
app.use(helmet());
app.use(cors(createCorsOptions(env.CORS_ALLOWED_ORIGINS)));
app.use(
	"/api",
	createApiRateLimiter({
		windowMs: env.RATE_LIMIT_WINDOW_MS,
		limit: env.RATE_LIMIT_MAX_REQUESTS,
	}),
);
app.use(express.json({ limit: "100kb" }));

app.get("/openapi.json", getOpenApiDocument);
app.use("/health", healthRouter);
app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(logErrors);
app.use(errorHandler);
