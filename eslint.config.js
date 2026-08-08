import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
	{
		ignores: [
			"dist/**",
			"node_modules/**",
			"supabase/**",
		],
	},
	{
		files: ["**/*.ts"],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			tseslint.configs.stylistic,
		],
		rules: {
			"no-undef": "off",
		},
	},
	eslintConfigPrettier,
);