import cors from "cors";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
	corsAllowedOriginsSchema,
	createCorsOptions,
} from "../../../src/config/cors.js";

const allowedOrigin = "http://localhost:3000";
const blockedOrigin = "https://untrusted.example";

function createTestApp() {
	const app = express();

	app.use(cors(createCorsOptions([allowedOrigin])));
	app.get("/resource", (req, res) => {
		res.status(200).json({ status: "ok" });
	});

	return app;
}

describe("CORS origin parsing", () => {
	it("parses and trims a comma-separated allowlist", () => {
		expect(
			corsAllowedOriginsSchema.parse(
				"http://localhost:3000, https://app.example",
			),
		).toEqual(["http://localhost:3000", "https://app.example"]);
	});

	it("uses an empty allowlist when the variable is absent", () => {
		expect(corsAllowedOriginsSchema.parse(undefined)).toEqual([]);
	});

	it("rejects values that are not exact origins", () => {
		expect(() =>
			corsAllowedOriginsSchema.parse("https://app.example/path"),
		).toThrow();
		expect(() =>
			corsAllowedOriginsSchema.parse("https://app.example/"),
		).toThrow();
	});
});

describe("CORS configuration", () => {
	it("allows a configured browser origin", async () => {
		const response = await request(createTestApp())
			.get("/resource")
			.set("Origin", allowedOrigin);

		expect(response.status).toBe(200);
		expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
	});

	it("does not grant CORS access to an unconfigured origin", async () => {
		const response = await request(createTestApp())
			.get("/resource")
			.set("Origin", blockedOrigin);

		expect(response.status).toBe(200);
		expect(response.headers["access-control-allow-origin"]).toBeUndefined();
	});

	it("allows requests without an Origin header", async () => {
		const response = await request(createTestApp()).get("/resource");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ status: "ok" });
		expect(response.headers["access-control-allow-origin"]).toBeUndefined();
	});

	it("handles preflight requests for a configured origin", async () => {
		const response = await request(createTestApp())
			.options("/resource")
			.set("Origin", allowedOrigin)
			.set("Access-Control-Request-Method", "GET");

		expect(response.status).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
		expect(response.headers["access-control-allow-methods"]).toContain("GET");
	});
});
