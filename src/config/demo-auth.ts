import { env } from "./env.js";
import type { DemoRole } from "../validation/demo-login.schema.js";

interface DemoAccount {
	email: string;
	password: string | undefined;
}

const demoAccounts = {
	owner: {
		email: "owner@example.test",
		password: env.DEMO_OWNER_PASSWORD,
	},
	requester: {
		email: "requester@example.test",
		password: env.DEMO_REQUESTER_PASSWORD,
	},
	other: {
		email: "other@example.test",
		password: env.DEMO_OTHER_PASSWORD,
	},
} satisfies Record<DemoRole, DemoAccount>;

export function getDemoAccount(role: DemoRole) {
	const account = demoAccounts[role];

	if (!account.password) {
		throw new Error("Demo access is enabled without complete credentials.");
	}

	return {
		email: account.email,
		password: account.password,
	};
}
