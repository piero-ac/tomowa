import express from "express";
import { requireAuth } from "../middleware/require-auth.js";
import meRouter from "./me.routes.js";
import sessionsRouter from "./session.routes.js";

const apiRouter = express.Router();

apiRouter.use("/sessions", requireAuth, sessionsRouter);
apiRouter.use("/me", requireAuth, meRouter);

export default apiRouter;
