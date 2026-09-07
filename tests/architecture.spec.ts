import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const workspaceNamespace = "@meetup-automation/";

type WorkspaceLayer = "domain" | "application" | "adapter" | "runtime";

type WorkspacePackage = Readonly<{
	name: string;
	layer: WorkspaceLayer;
	directory: string;
	dependencies: readonly string[];
}>;

async function filesBelow(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			return entry.isDirectory() ? filesBelow(path) : [path];
		}),
	);
	return nested.flat();
}

describe("clean architecture boundaries", () => {
	it("keeps technology and runtime imports outside domain packages", async () => {
		const domainRoot = join(repositoryRoot, "packages/domain");
		const sourceFiles = (await filesBelow(domainRoot)).filter((path) =>
			path.endsWith(".ts"),
		);
		const forbidden = [
			/['"]@actions\//,
			/['"]@octokit\//,
			/['"]node:fs/,
			/['"]node:path/,
			/['"]csv-parse/,
			/['"]yaml['"]/,
			/['"]@meetup-automation\/(?:github|csv|yaml|slack|system|.*-gateway)/,
			/['"]@meetup-automation\/github-actions-runtime/,
		];

		const violations: string[] = [];
		for (const path of sourceFiles) {
			const source = await readFile(path, "utf8");
			if (forbidden.some((pattern) => pattern.test(source))) {
				violations.push(relative(repositoryRoot, path));
			}
		}

		expect(violations).toEqual([]);
	});

	it("uses responsibility-bearing adapter package names", async () => {
		const adapterRoot = join(repositoryRoot, "packages/adapter");
		const entries = await readdir(adapterRoot, { withFileTypes: true });
		const packageNames = entries.filter((entry) => entry.isDirectory());

		expect(packageNames.length).toBeGreaterThan(0);
		for (const entry of packageNames) {
			const packageName = entry.name;
			expect(packageName).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+){1,}$/);
			expect(["github", "csv", "yaml", "slack", "system"]).not.toContain(
				packageName,
			);
			const project = JSON.parse(
				await readFile(join(adapterRoot, packageName, "project.json"), "utf8"),
			) as { tags?: readonly string[] };
			const technology = project.tags
				?.find((tag) => tag.startsWith("technology:"))
				?.slice("technology:".length);
			const responsibility = project.tags
				?.find((tag) => tag.startsWith("responsibility:"))
				?.slice("responsibility:".length);
			expect(technology, `${packageName} technology tag`).toBeTruthy();
			expect(responsibility, `${packageName} responsibility tag`).toBeTruthy();
			expect(packageName).toBe(`${technology}-${responsibility}`);
		}
	});

	it("enforces inward workspace dependencies and an acyclic package graph", async () => {
		const packages = await workspacePackages();
		const byName = new Map(packages.map((item) => [item.name, item]));
		const violations: string[] = [];

		for (const item of packages) {
			for (const dependencyName of item.dependencies) {
				const dependency = byName.get(dependencyName);
				if (!dependency) {
					violations.push(`${item.name} references unknown ${dependencyName}`);
					continue;
				}
				if (!dependencyLayerAllowed(item.layer, dependency.layer)) {
					violations.push(
						`${item.name} (${item.layer}) depends on ${dependency.name} (${dependency.layer})`,
					);
				}
			}
		}

		const visiting = new Set<string>();
		const visited = new Set<string>();
		const visit = (name: string, path: readonly string[]): void => {
			if (visiting.has(name)) {
				violations.push(
					`workspace dependency cycle: ${[...path, name].join(" -> ")}`,
				);
				return;
			}
			if (visited.has(name)) return;
			visiting.add(name);
			for (const dependency of byName.get(name)?.dependencies ?? []) {
				visit(dependency, [...path, name]);
			}
			visiting.delete(name);
			visited.add(name);
		};
		for (const item of packages) visit(item.name, []);

		expect(violations).toEqual([]);
	});

	it("uses package entrypoints and makes adapter port conformance explicit", async () => {
		const packages = await workspacePackages();
		const packageNames = new Set(packages.map(({ name }) => name));
		const violations: string[] = [];

		for (const item of packages) {
			const sourceFiles = (
				await filesBelow(join(item.directory, "src"))
			).filter((path) => path.endsWith(".ts"));
			let adapterImplementsPort = item.layer !== "adapter";
			for (const path of sourceFiles) {
				const source = await readFile(path, "utf8");
				for (const match of source.matchAll(
					/['"](@meetup-automation\/[^'"]+)['"]/g,
				)) {
					const specifier = match[1];
					if (specifier && !packageNames.has(specifier)) {
						violations.push(
							`${relative(repositoryRoot, path)} deep-imports ${specifier}`,
						);
					}
				}
				adapterImplementsPort ||= /\bimplements\s+[A-Z]/.test(source);
			}
			if (!adapterImplementsPort) {
				violations.push(
					`${item.name} does not explicitly implement an owned port`,
				);
			}
		}

		expect(violations).toEqual([]);
	});
});

async function workspacePackages(): Promise<readonly WorkspacePackage[]> {
	const packageRoot = join(repositoryRoot, "packages");
	const layers: readonly WorkspaceLayer[] = [
		"domain",
		"application",
		"adapter",
		"runtime",
	];
	const packages: WorkspacePackage[] = [];
	for (const layer of layers) {
		const layerRoot = join(packageRoot, layer);
		const entries = await readdir(layerRoot, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const directory = join(layerRoot, entry.name);
			const manifest = JSON.parse(
				await readFile(join(directory, "package.json"), "utf8"),
			) as {
				name: string;
				dependencies?: Readonly<Record<string, string>>;
			};
			packages.push({
				name: manifest.name,
				layer,
				directory,
				dependencies: Object.keys(manifest.dependencies ?? {}).filter((name) =>
					name.startsWith(workspaceNamespace),
				),
			});
		}
	}
	return packages;
}

function dependencyLayerAllowed(
	consumer: WorkspaceLayer,
	dependency: WorkspaceLayer,
): boolean {
	const allowed: Readonly<Record<WorkspaceLayer, readonly WorkspaceLayer[]>> = {
		domain: [],
		application: ["domain"],
		adapter: ["domain", "application"],
		runtime: ["domain", "application", "adapter"],
	};
	return allowed[consumer].includes(dependency);
}
