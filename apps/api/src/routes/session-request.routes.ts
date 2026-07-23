import express from "express";

import * as sessionRequestController from "../controllers/session-requests.controller.js";

const router = express.Router({
	mergeParams: true,
});

router.post("/", sessionRequestController.createSessionRequest);
router.post(
	"/:requestId/decline",
	sessionRequestController.declineSessionRequest,
);
router.post(
	"/:requestId/cancel",
	sessionRequestController.cancelSessionRequest,
);
router.post(
	"/:requestId/approve",
	sessionRequestController.approveSessionRequest,
);

export default router;
