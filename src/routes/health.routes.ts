import express, { type Request, type Response } from "express";

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
	res.status(200).json({
		status: "ok",
		service: "tomowa-api",
	});
});

export default router;
