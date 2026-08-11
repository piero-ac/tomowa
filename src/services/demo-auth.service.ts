import { env } from "../config/env.js";
import { getDemoAccount } from "../config/demo-auth.js";
import { NotFoundError, ServiceUnavailableError } from "../errors/index.js";
import { createStatelessSupabaseClient } from "../lib/supabase.js";
import type { DemoLoginResponse } from "../types/demo-auth.js";
import type { DemoRole } from "../validation/demo-login.schema.js";

export async function loginDemoUser(
	role: DemoRole,
): Promise<DemoLoginResponse> {
	if (!env.DEMO_ACCESS_ENABLED) {
		throw new NotFoundError("Route not found.");
	}

	const account = getDemoAccount(role);
	const supabaseClient = createStatelessSupabaseClient();
	const { data, error } = await supabaseClient.auth.signInWithPassword(account);

	if (error || !data.session?.access_token || !data.session.expires_at) {
		throw new ServiceUnavailableError("Demo login is temporarily unavailable.");
	}

	return {
		role,
		accessToken: data.session.access_token,
		expiresAt: data.session.expires_at,
	};
}
