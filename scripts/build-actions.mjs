import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

export const actionBundles = [
	[
		"packages/runtime/github-actions/src/entrypoints/publication-reconcile-feedback.ts",
		"actions/publication/reconcile-feedback/dist/index.js",
	],
	[
		"packages/runtime/github-actions/src/entrypoints/publication-reconcile-assets.ts",
		"actions/publication/reconcile-assets/dist/index.js",
	],
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

export async function buildActionBundles() {
	for (const [entryPoint, outfile] of actionBundles) {
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
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	await buildActionBundles();
}
