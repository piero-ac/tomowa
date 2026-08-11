import { z } from "zod";

export const demoRoleSchema = z.enum(["owner", "requester", "other"]);

export const demoLoginSchema = z
	.object({
		role: demoRoleSchema,
	})
	.strict();

export type DemoLoginBody = z.infer<typeof demoLoginSchema>;
export type DemoRole = z.infer<typeof demoRoleSchema>;
