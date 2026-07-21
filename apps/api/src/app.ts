import cors from "cors";
import express from "express";
import helmet from "helmet";

import apiRouter from "./routes/index.js";
import healthRouter from "./routes/health.routes.js";

import { errorHandler } from "./middleware/error-handler.js";
import { logErrors } from "./middleware/log-errors.js";
import { notFoundHandler } from "./middleware/not-found.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.use("/health", healthRouter);
app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(logErrors);
app.use(errorHandler);
