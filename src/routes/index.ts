import express from "express";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/require-auth.js";
import demoAuthRouter from "./demo-auth.routes.js";
import meRouter from "./me.routes.js";
import sessionsRouter from "./session.routes.js";

const apiRouter = express.Router();

if (env.DEMO_ACCESS_ENABLED) {
	apiRouter.use("/demo", demoAuthRouter);
}

apiRouter.use("/sessions", requireAuth, sessionsRouter);
apiRouter.use("/me", requireAuth, meRouter);

export default apiRouter;
