import type { DemoRole } from "../validation/demo-login.schema.js";

export interface DemoLoginResponse {
	role: DemoRole;
	accessToken: string;
	expiresAt: number;
}
