import { defineConfig } from "vitest/config";

export default defineConfig({
	root: import.meta.dirname,
	test: {
		coverage: {
			include: ["src/**/*.ts"],
			provider: "v8",
			thresholds: {
				branches: 85,
				functions: 85,
				lines: 90,
				statements: 90,
			},
		},
		environment: "node",
		include: ["__tests__/**/*.test.ts"],
	},
});
