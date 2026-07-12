import express, { type Request, type Response } from "express";

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
	res.status(501).json({
		status: "not-implemented",
		service: "tomowa-api-sessions",
	});
});

export default router;
