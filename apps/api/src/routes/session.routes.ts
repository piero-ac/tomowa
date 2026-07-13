import express from "express";
import * as sessionController from "../controllers/sessions.controller.js";

const router = express.Router();

router.get("/", sessionController.getSessions);

export default router;
