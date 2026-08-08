import { createClient } from "@supabase/supabase-js";

type SeedUserEmail =
	"owner@example.test" | "requester@example.test" | "other@example.test";

function requireTestVariable(name: string) {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} is required for authenticated tests.`);
	}

	return value;
}

const supabase = createClient(
	requireTestVariable("SUPABASE_URL"),
	requireTestVariable("SUPABASE_PUBLISHABLE_KEY"),
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	},
);

export async function getAccessToken(email: SeedUserEmail) {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password: requireTestVariable("LOCAL_SEED_PASSWORD"),
	});

	if (error || !data.session) {
		throw new Error(`Could not authenticate seeded user ${email}.`, {
			cause: error,
		});
	}

	return data.session.access_token;
}
