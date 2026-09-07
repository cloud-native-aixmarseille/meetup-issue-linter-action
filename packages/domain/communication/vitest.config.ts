import { defineConfig } from "vitest/config";

export default defineConfig({
	root: import.meta.dirname,
	test: {
		coverage: {
			exclude: ["src/**/*.test.ts"],
			include: ["src/**/*.ts"],
			provider: "v8",
			thresholds: {
				branches: 90,
				functions: 95,
				lines: 95,
				statements: 95,
			},
		},
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
