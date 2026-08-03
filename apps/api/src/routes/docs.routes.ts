import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";

import { openapiDocument } from "../docs/openapi.js";

const router = express.Router();

router.use(swaggerUi.serve);

router.get(
	"/",
	swaggerUi.setup(openapiDocument, {
		customSiteTitle: "Tomowa API Documentation",
	}),
);

export function getOpenApiDocument(_req: Request, res: Response) {
	res.status(200).json(openapiDocument);
}

export default router;
