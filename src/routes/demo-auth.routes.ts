import express from "express";

import * as demoAuthController from "../controllers/demo-auth.controller.js";
import { createDemoLoginRateLimiter } from "../config/rate-limit.js";

const router = express.Router();

router.post(
	"/login",
	createDemoLoginRateLimiter(),
	demoAuthController.loginDemoUser,
);

export default router;
