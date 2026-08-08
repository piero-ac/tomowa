import express from "express";
import * as sessionController from "../controllers/sessions.controller.js";
import sessionRequestRouter from "./session-request.routes.js";

const router = express.Router();

router.get("/", sessionController.getSessions);
router.get("/:sessionId", sessionController.getSessionById);
router.post("/", sessionController.createSession);
router.patch("/:sessionId", sessionController.updateSession);
router.delete("/:sessionId", sessionController.deleteSession);
router.use("/:sessionId/requests", sessionRequestRouter);

export default router;
