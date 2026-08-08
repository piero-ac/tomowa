import express from "express";

import * as meController from "../controllers/me.controller.js";

const router = express.Router();

router.get("/profile", meController.getProfile);
router.patch("/profile", meController.updateProfile);
router.get("/sessions-created", meController.getCreatedSessions);
router.get("/session-requests", meController.getUserSessionRequests);
router.get("/sessions-booked", meController.getBookedSessions);

export default router;
