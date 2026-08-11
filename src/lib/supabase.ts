import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export function createStatelessSupabaseClient() {
	return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	});
}

export const supabase = createStatelessSupabaseClient();
