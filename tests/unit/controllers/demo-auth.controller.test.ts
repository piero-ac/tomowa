import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	loginDemoUser: vi.fn(),
}));

vi.mock("../../../src/services/demo-auth.service.js", () => ({
	loginDemoUser: mocks.loginDemoUser,
}));

import * as demoAuthController from "../../../src/controllers/demo-auth.controller.js";

function createResponse() {
	const response = {
		set: vi.fn(),
		status: vi.fn(),
		json: vi.fn(),
	} as unknown as Response;

	vi.mocked(response.status).mockReturnValue(response);

	return response;
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("loginDemoUser controller", () => {
	it("validates the role and returns the service response", async () => {
		const serviceResponse = {
			role: "owner" as const,
			accessToken: "demo-access-token",
			expiresAt: 1_800_000_000,
		};
		const request = {
			body: {
				role: "owner",
			},
		} as Request;
		const response = createResponse();

		mocks.loginDemoUser.mockResolvedValue(serviceResponse);

		await demoAuthController.loginDemoUser(request, response);

		expect(mocks.loginDemoUser).toHaveBeenCalledWith("owner");
		expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store");
		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.json).toHaveBeenCalledWith(serviceResponse);
	});

	it.each([
		{ role: "admin" },
		{ role: "owner", password: "client-supplied-password" },
		{},
	])("rejects the invalid body %o", async (body) => {
		const request = { body } as Request;
		const response = createResponse();

		await expect(
			demoAuthController.loginDemoUser(request, response),
		).rejects.toMatchObject({
			name: "BadRequestError",
			statusCode: 400,
			message: "Validation failed.",
		});
		expect(mocks.loginDemoUser).not.toHaveBeenCalled();
	});
});
