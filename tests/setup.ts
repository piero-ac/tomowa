import "dotenv/config";

function assertLocalUrl(name: string, value: string | undefined) {
	if (!value) {
		throw new Error(`${name} is required for tests.`);
	}

	const hostname = new URL(value).hostname;
	const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

	if (!localHosts.has(hostname)) {
		throw new Error(
			`${name} must point to a local service during tests. Received: ${hostname}`,
		);
	}
}

assertLocalUrl("DATABASE_URL", process.env.DATABASE_URL);
assertLocalUrl("SUPABASE_URL", process.env.SUPABASE_URL);

const localSeedPassword = process.env.LOCAL_SEED_PASSWORD;

if (!localSeedPassword) {
	throw new Error("LOCAL_SEED_PASSWORD is required for integration tests.");
}

process.env.DEMO_ACCESS_ENABLED = "true";
process.env.DEMO_OWNER_PASSWORD = localSeedPassword;
process.env.DEMO_REQUESTER_PASSWORD = localSeedPassword;
process.env.DEMO_OTHER_PASSWORD = localSeedPassword;
