import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { build } from "esbuild";

const entries = [
	[
		"packages/runtime/github-actions/src/entrypoints/event-reconcile.ts",
		"actions/event/reconcile/dist/index.js",
	],
	[
		"packages/runtime/github-actions/src/entrypoints/event-list-active.ts",
		"actions/event/list-active/dist/index.js",
	],
	[
		"packages/runtime/github-actions/src/entrypoints/referential-validate.ts",
		"actions/referential/validate/dist/index.js",
	],
	[
		"packages/runtime/github-actions/src/entrypoints/referential-sync-issue-form.ts",
		"actions/referential/sync-issue-form/dist/index.js",
	],
	[
		"packages/runtime/github-actions/src/entrypoints/communication-reconcile.ts",
		"actions/communication/reconcile/dist/index.js",
	],
];

for (const [entryPoint, outfile] of entries) {
	await mkdir(dirname(outfile), { recursive: true });
	await build({
		entryPoints: [entryPoint],
		outfile,
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node24",
		sourcemap: false,
		banner: {
			js: 'import { createRequire } from "node:module";const require = createRequire(import.meta.url);',
		},
	});
}
