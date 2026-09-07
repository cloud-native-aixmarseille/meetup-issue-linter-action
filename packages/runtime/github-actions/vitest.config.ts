import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["packages/runtime/github-actions/src/**/*.test.ts"],
	},
});
