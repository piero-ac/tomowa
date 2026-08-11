import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	env: {
		DEMO_ACCESS_ENABLED: true,
	},
	getDemoAccount: vi.fn(),
	createStatelessSupabaseClient: vi.fn(),
	signInWithPassword: vi.fn(),
}));

vi.mock("../../../src/config/env.js", () => ({
	env: mocks.env,
}));

vi.mock("../../../src/config/demo-auth.js", () => ({
	getDemoAccount: mocks.getDemoAccount,
}));

vi.mock("../../../src/lib/supabase.js", () => ({
	createStatelessSupabaseClient: mocks.createStatelessSupabaseClient,
}));

import * as demoAuthService from "../../../src/services/demo-auth.service.js";

const account = {
	email: "owner@example.test",
	password: "server-controlled-password",
};

beforeEach(() => {
	vi.resetAllMocks();
	mocks.env.DEMO_ACCESS_ENABLED = true;
	mocks.getDemoAccount.mockReturnValue(account);
	mocks.createStatelessSupabaseClient.mockReturnValue({
		auth: {
			signInWithPassword: mocks.signInWithPassword,
		},
	});
});

describe("loginDemoUser", () => {
	it("returns only the selected role and short-lived access token data", async () => {
		mocks.signInWithPassword.mockResolvedValue({
			data: {
				session: {
					access_token: "demo-access-token",
					expires_at: 1_800_000_000,
					refresh_token: "must-not-be-returned",
				},
			},
			error: null,
		});

		const result = await demoAuthService.loginDemoUser("owner");

		expect(result).toEqual({
			role: "owner",
			accessToken: "demo-access-token",
			expiresAt: 1_800_000_000,
		});
		expect(mocks.getDemoAccount).toHaveBeenCalledWith("owner");
		expect(mocks.createStatelessSupabaseClient).toHaveBeenCalledOnce();
		expect(mocks.signInWithPassword).toHaveBeenCalledWith(account);
	});

	it("hides the login capability when demo access is disabled", async () => {
		mocks.env.DEMO_ACCESS_ENABLED = false;

		await expect(demoAuthService.loginDemoUser("owner")).rejects.toMatchObject({
			name: "NotFoundError",
			statusCode: 404,
			message: "Route not found.",
		});
		expect(mocks.getDemoAccount).not.toHaveBeenCalled();
		expect(mocks.createStatelessSupabaseClient).not.toHaveBeenCalled();
	});

	it("returns a safe service error when Supabase rejects the credentials", async () => {
		mocks.signInWithPassword.mockResolvedValue({
			data: {
				session: null,
			},
			error: new Error("Invalid login credentials"),
		});

		await expect(demoAuthService.loginDemoUser("owner")).rejects.toMatchObject({
			name: "ServiceUnavailableError",
			statusCode: 503,
			message: "Demo login is temporarily unavailable.",
		});
	});

	it("rejects an incomplete Supabase session", async () => {
		mocks.signInWithPassword.mockResolvedValue({
			data: {
				session: {
					access_token: "demo-access-token",
				},
			},
			error: null,
		});

		await expect(demoAuthService.loginDemoUser("owner")).rejects.toMatchObject({
			name: "ServiceUnavailableError",
			statusCode: 503,
			message: "Demo login is temporarily unavailable.",
		});
	});
});
