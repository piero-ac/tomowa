import cors from "cors";
import express from "express";
import helmet from "helmet";
import healthRouter from "./routes/heath.routes.js";
import sessionsRouter from "./routes/session.routes.js";
import meRouter from "./routes/me.routes.js";

import { errorHandler } from "./middleware/error-handler.js";
import { logErrors } from "./middleware/log-errors.js";
import { notFoundHandler } from "./middleware/not-found.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/sessions", sessionsRouter);
app.use("/me", meRouter);

app.use(notFoundHandler);
app.use(logErrors);
app.use(errorHandler);
