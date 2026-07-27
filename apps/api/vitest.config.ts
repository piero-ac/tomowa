import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		setupFiles: ["./tests/setup.ts"],
		silent: "passed-only",
		fileParallelism: false,
	},
});
