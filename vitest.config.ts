import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		silent: "passed-only",
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["tests/unit/**/*.test.ts"],
				},
			},
			{
				test: {
					name: "integration",
					environment: "node",
					include: ["tests/integration/**/*.test.ts"],
					setupFiles: ["./tests/setup.ts"],
					fileParallelism: false,
				},
			},
		],
	},
});
