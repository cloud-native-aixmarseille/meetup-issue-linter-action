import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
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
