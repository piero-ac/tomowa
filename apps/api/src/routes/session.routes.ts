import express from "express";
import * as sessionController from "../controllers/sessions.controller.js";

const router = express.Router();

router.get("/", sessionController.getSessions);
router.get("/:sessionId", sessionController.getSessionById);
router.post("/", sessionController.createSession);
router.patch("/:sessionId", sessionController.updateSession);

export default router;
