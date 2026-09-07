import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	test: {
		coverage: {
			include: ["src/**/*.ts"],
			provider: "v8",
		},
		environment: "node",
		globals: true,
		include: ["__tests__/**/*.spec.ts"],
	},
});
