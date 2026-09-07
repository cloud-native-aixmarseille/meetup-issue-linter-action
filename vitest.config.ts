import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@meetup-automation/event": fileURLToPath(
				new URL("./packages/domain/event/src/index.ts", import.meta.url),
			),
			"@meetup-automation/publication": fileURLToPath(
				new URL("./packages/domain/publication/src/index.ts", import.meta.url),
			),
		},
	},
	test: {
		coverage: {
			exclude: [
				"**/*.{spec,test}.ts",
				"packages/runtime/github-actions/src/entrypoints/**/*.ts",
			],
			include: ["src/**/*.ts", "packages/**/*.ts"],
			provider: "v8",
			thresholds: {
				branches: 85,
				functions: 85,
				lines: 90,
				statements: 90,
			},
		},
		environment: "node",
		globals: true,
		include: [
			"src/**/*.{spec,test}.ts",
			"packages/**/*.{spec,test}.ts",
			"tests/**/*.spec.ts",
		],
	},
});
