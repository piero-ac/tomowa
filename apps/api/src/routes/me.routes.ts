import express from "express";

import * as meController from "../controllers/me.controller.js";

const router = express.Router();

router.get("/sessions-created", meController.getCreatedSessions);

export default router;
