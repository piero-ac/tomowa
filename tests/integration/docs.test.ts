import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("API documentation", () => {
	it("serves the OpenAPI document without authentication", async () => {
		const response = await request(app).get("/openapi.json");

		expect(response.status).toBe(200);
		expect(response.type).toBe("application/json");
		expect(response.body).toMatchObject({
			openapi: "3.1.0",
			security: [{ bearerAuth: [] }],
		});
		expect(response.body.paths).toHaveProperty("/health");
		expect(response.body.paths).toHaveProperty("/api/demo/login");
		expect(response.body.paths).toHaveProperty("/api/sessions");
		expect(response.body.paths["/api/demo/login"].post.security).toEqual([]);
		expect(response.body.components.securitySchemes.bearerAuth).toMatchObject({
			type: "http",
			scheme: "bearer",
			bearerFormat: "JWT",
		});
	});

	it("serves the Swagger UI without authentication", async () => {
		const response = await request(app).get("/docs/");

		expect(response.status).toBe(200);
		expect(response.type).toBe("text/html");
		expect(response.text).toContain("Tomowa API Documentation");
	});

	it("serves Swagger UI static assets", async () => {
		const response = await request(app).get("/docs/swagger-ui.css");

		expect(response.status).toBe(200);
		expect(response.type).toBe("text/css");
	});
});
