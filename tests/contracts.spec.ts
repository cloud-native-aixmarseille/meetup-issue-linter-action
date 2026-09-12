import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Inputs = Record<
	string,
	{
		default?: unknown;
		description?: string;
		required?: boolean;
		type?: string;
	}
>;

interface Step {
	env?: Record<string, unknown>;
	id?: string;
	if?: string;
	name?: string;
	run?: string;
	uses?: string;
	with?: Record<string, unknown>;
}

interface Job {
	concurrency?: {
		"cancel-in-progress"?: boolean;
		group?: string;
	};
	if?: string;
	needs?: string | string[];
	permissions?: Record<string, unknown>;
	secrets?: Record<string, unknown>;
	steps?: Step[];
	uses?: string;
	with?: Record<string, unknown>;
}

interface Workflow {
	jobs?: Record<string, Job>;
	name?: string;
	on?: {
		workflow_call?: {
			inputs?: Inputs;
			outputs?: Record<string, unknown>;
			secrets?: Inputs;
		};
	};
	permissions?: Record<string, unknown>;
}

interface ActionManifest {
	inputs?: Inputs;
	outputs?: Record<string, unknown>;
	runs?: {
		main?: string;
		steps?: Step[];
		using?: string;
	};
}

const root = process.cwd();
const automationActionPrefix = "./../self-workflow/actions/";
const localWorkflowActionsRef =
	"hoverkraft-tech/ci-github-common/actions/local-workflow-actions@3a27d31e9ccefbe9609cc9165017ed100ff34a22";
const workflowExpression = (expression: string) => `\${{ ${expression} }}`;
const managedAuthor = workflowExpression(
	"format('{0}[bot]', steps.app-token.outputs.app-slug)",
);

const actionContracts = [
	{
		directory: "actions/publication/reconcile-assets",
		inputs: [
			"github-token",
			"google-credentials",
			"google-drive-meetup-folder-id",
			"google-drive-meetup-template-folder-id",
			"issue-number",
			"managed-comment-author",
			"mode",
		],
		outputs: ["asset-url", "diagnostics", "drive-files", "result"],
	},
	{
		directory: "actions/event/reconcile",
		inputs: ["github-token", "issue-number", "managed-comment-author", "mode"],
		outputs: ["diagnostics", "is-ready", "result", "state"],
	},
	{
		directory: "actions/event/list-active",
		inputs: ["github-token"],
		outputs: ["diagnostics", "issue-numbers", "result"],
	},
	{
		directory: "actions/referential/validate",
		inputs: [],
		outputs: [
			"diagnostics",
			"host-count",
			"is-valid",
			"result",
			"speaker-count",
		],
	},
	{
		directory: "actions/referential/sync-issue-form",
		inputs: ["mode"],
		outputs: ["changed", "changed-files", "diagnostics", "result"],
	},
	{
		directory: "actions/communication/reconcile",
		inputs: [
			"dispatch-authorized",
			"github-token",
			"issue-number",
			"mailings-token",
			"managed-comment-author",
			"mode",
			"slack-token",
		],
		outputs: ["diagnostics", "dispatched-count", "planned-count", "result"],
	},
] as const;

const publicWorkflowContracts = {
	"check-active-meetup-issues": {
		inputs: [
			"github-app-id",
			"google-drive-meetup-folder-id",
			"google-drive-meetup-template-folder-id",
			"slack-channel-id",
		],
		outputs: ["issue-numbers"],
		secrets: [
			"github-app-private-key",
			"google-credentials",
			"mailings-token",
			"slack-token",
		],
	},
	"update-meetup-issue": {
		inputs: [
			"github-app-id",
			"google-drive-meetup-folder-id",
			"google-drive-meetup-template-folder-id",
			"slack-channel-id",
		],
		outputs: ["communication-diagnostics", "diagnostics", "is-ready", "state"],
		secrets: [
			"github-app-private-key",
			"google-credentials",
			"mailings-token",
			"slack-token",
		],
	},
	"update-meetup-issue-form": {
		inputs: ["github-app-id"],
		outputs: [
			"changed",
			"changed-files",
			"diagnostics",
			"host-count",
			"is-valid",
			"referential-diagnostics",
			"speaker-count",
		],
		secrets: ["github-app-private-key"],
	},
	"check-meetup-referentials-and-issue-form": {
		inputs: [],
		outputs: [
			"host-count",
			"is-valid",
			"issue-form-changed",
			"issue-form-changed-files",
			"issue-form-diagnostics",
			"referential-diagnostics",
			"speaker-count",
		],
		secrets: [],
	},
} as const;

const expectedActionWiring = {
	"check-active-meetup-issues": {
		audit: [
			"publication/reconcile-assets",
			"event/reconcile",
			"communication/reconcile",
		],
		list: ["event/list-active"],
	},
	"update-meetup-issue": {
		manage: [
			"communication/reconcile",
			"publication/reconcile-assets",
			"event/reconcile",
		],
	},
	"update-meetup-issue-form": {
		synchronize: ["referential/validate", "referential/sync-issue-form"],
	},
	"check-meetup-referentials-and-issue-form": {
		validate: ["referential/validate", "referential/sync-issue-form"],
	},
} as const;

const sortedKeys = (value: Record<string, unknown> | undefined) =>
	Object.keys(value ?? {}).sort();

const readYaml = async <T>(path: string): Promise<T> =>
	parse(await readFile(join(root, path), "utf8")) as T;

const readWorkflow = (name: string) =>
	readYaml<Workflow>(`.github/workflows/${name}.yml`);

const findStep = (job: Job, uses: string) =>
	job.steps?.find((step) => step.uses === uses);

describe("public action contracts", () => {
	it.each(
		actionContracts,
	)("publishes the exact metadata contract and bundle for $directory", async ({
		directory,
		inputs,
		outputs,
	}) => {
		const manifest = await readYaml<ActionManifest>(
			join(directory, "action.yml"),
		);

		expect(manifest.runs).toMatchObject({
			main: "dist/index.js",
			using: "node24",
		});
		expect(sortedKeys(manifest.inputs)).toEqual([...inputs].sort());
		expect(sortedKeys(manifest.outputs)).toEqual([...outputs].sort());
		const readmePath = join(root, directory, "README.md");
		await expect(access(readmePath)).resolves.toBeUndefined();
		expect(await readFile(readmePath, "utf8")).toContain(
			"This documentation was automatically generated by [CI Dokumentor]",
		);
		await expect(
			access(join(root, directory, "dist/index.js")),
		).resolves.toBeUndefined();
	});

	it("keeps managed-author and dispatch authorization fail-closed", async () => {
		const event = await readYaml<ActionManifest>(
			"actions/event/reconcile/action.yml",
		);
		const communication = await readYaml<ActionManifest>(
			"actions/communication/reconcile/action.yml",
		);

		expect(event.inputs?.["managed-comment-author"]?.required).toBe(true);
		expect(communication.inputs?.["managed-comment-author"]?.required).toBe(
			true,
		);
		expect(communication.inputs?.["dispatch-authorized"]).toMatchObject({
			default: "false",
			required: false,
		});
	});
});

describe("public reusable workflow contracts", () => {
	it.each(
		Object.entries(publicWorkflowContracts),
	)("publishes the exact caller contract and generated documentation for %s", async (name, expected) => {
		const workflow = await readWorkflow(name);
		const contract = workflow.on?.workflow_call;
		const documentation = await readFile(
			join(root, `.github/workflows/${name}.md`),
			"utf8",
		);

		expect(workflow.permissions).toEqual({});
		expect(sortedKeys(contract?.inputs)).toEqual([...expected.inputs].sort());
		expect(sortedKeys(contract?.secrets)).toEqual([...expected.secrets].sort());
		expect(sortedKeys(contract?.outputs)).toEqual([...expected.outputs].sort());
		expect(documentation).toContain(
			`GitHub Reusable Workflow: ${workflow.name}`,
		);
		expect(documentation).toContain(
			"This documentation was automatically generated by [CI Dokumentor]",
		);
	});

	it("loads every brain action from the reusable workflow revision", async () => {
		for (const [workflowName, jobs] of Object.entries(expectedActionWiring)) {
			const workflow = await readWorkflow(workflowName);
			for (const [jobName, expectedActions] of Object.entries(jobs)) {
				const actionNames = expectedActions as readonly string[];
				const job = workflow.jobs?.[jobName];
				expect(job, `${workflowName}/${jobName}`).toBeDefined();
				const actionSteps = (job?.steps ?? []).filter((step) =>
					step.uses?.startsWith(automationActionPrefix),
				);
				expect(actionSteps.map((step) => step.uses)).toEqual(
					actionNames.map((action) => `${automationActionPrefix}${action}`),
				);

				const workflowSourceIndex = (job?.steps ?? []).findIndex(
					(step) =>
						step.id === "local-workflow-actions" &&
						step.uses === localWorkflowActionsRef &&
						step.with?.["actions-path"] === "actions",
				);
				const firstActionIndex = (job?.steps ?? []).indexOf(actionSteps[0]);
				expect(
					workflowSourceIndex,
					`${workflowName}/${jobName} local workflow actions loader`,
				).toBeGreaterThanOrEqual(0);
				expect(workflowSourceIndex).toBeLessThan(firstActionIndex);
			}
		}
	});

	it("pins every external workflow dependency to a full commit SHA", async () => {
		const workflowFiles = (
			await readdir(join(root, ".github/workflows"))
		).filter((name) => name.endsWith(".yml"));
		const externalUses: string[] = [];
		for (const file of workflowFiles) {
			const workflow = await readYaml<Workflow>(`.github/workflows/${file}`);
			for (const job of Object.values(workflow.jobs ?? {})) {
				if (job.uses && !job.uses.startsWith("./")) externalUses.push(job.uses);
				for (const step of job.steps ?? []) {
					if (step.uses && !step.uses.startsWith("./")) {
						externalUses.push(step.uses);
					}
				}
			}
		}
		for (const action of actionContracts) {
			const manifest = await readYaml<ActionManifest>(
				join(action.directory, "action.yml"),
			);
			for (const step of manifest.runs?.steps ?? []) {
				if (step.uses && !step.uses.startsWith("./"))
					externalUses.push(step.uses);
			}
		}

		expect(externalUses.length).toBeGreaterThan(0);
		for (const uses of externalUses) {
			expect(uses).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
		}
	});
});

describe("event side-effect safeguards", () => {
	it("keeps asset mutations optional and protected by the shared event lock", async () => {
		const action = await readYaml<ActionManifest>(
			"actions/publication/reconcile-assets/action.yml",
		);
		expect(action.inputs?.["google-credentials"]?.required).toBe(false);
		for (const [name, jobName] of [
			["update-meetup-issue", "manage"],
			["check-active-meetup-issues", "audit"],
		]) {
			const workflow = await readWorkflow(name);
			const job = workflow.jobs?.[jobName] ?? {};
			const step = findStep(
				job,
				`${automationActionPrefix}publication/reconcile-assets`,
			);
			expect(job.concurrency?.["cancel-in-progress"]).toBe(false);
			expect(step?.with).toMatchObject({
				mode: "fix",
				"google-credentials": workflowExpression("secrets.google-credentials"),
				"managed-comment-author": managedAuthor,
				"google-drive-meetup-folder-id": workflowExpression(
					"inputs.google-drive-meetup-folder-id",
				),
				"google-drive-meetup-template-folder-id": workflowExpression(
					"inputs.google-drive-meetup-template-folder-id",
				),
			});
			expect(step?.with).not.toHaveProperty("mutation-authorized");
			expect(step?.env).toBeUndefined();
			expect(
				workflow.on?.workflow_call?.secrets?.["google-credentials"]?.required,
			).toBe(false);
			expect(
				workflow.on?.workflow_call?.inputs?.["google-drive-meetup-folder-id"],
			).toBeDefined();
			expect(
				workflow.on?.workflow_call?.inputs?.[
					"google-drive-meetup-template-folder-id"
				],
			).toBeDefined();
		}
	});
	it("shares one non-cancelling event lock between issue and audit paths", async () => {
		const manage = await readWorkflow("update-meetup-issue");
		const audit = await readWorkflow("check-active-meetup-issues");
		const manageLock = manage.jobs?.manage.concurrency;
		const auditLock = audit.jobs?.audit.concurrency;

		expect(manageLock).toEqual({
			"cancel-in-progress": false,
			group: `meetup-event-${workflowExpression("github.repository_id")}-${workflowExpression("github.event.issue.number")}`,
		});
		expect(auditLock).toEqual({
			"cancel-in-progress": false,
			group: `meetup-event-${workflowExpression("github.repository_id")}-${workflowExpression("matrix.issue-number")}`,
		});
	});

	it("derives managed authors from the scoped application token", async () => {
		for (const [workflowName, jobName] of [
			["update-meetup-issue", "manage"],
			["check-active-meetup-issues", "audit"],
		] as const) {
			const workflow = await readWorkflow(workflowName);
			const job = workflow.jobs?.[jobName] ?? {};
			const appTokenIndex = (job.steps ?? []).findIndex(
				(step) =>
					step.id === "app-token" &&
					step.uses?.startsWith("actions/create-github-app-token@"),
			);
			for (const action of ["event/reconcile", "communication/reconcile"]) {
				const stepIndex = (job.steps ?? []).findIndex(
					(step) => step.uses === `${automationActionPrefix}${action}`,
				);
				expect(stepIndex).toBeGreaterThan(appTokenIndex);
				expect(job.steps?.[stepIndex].with?.["managed-comment-author"]).toBe(
					managedAuthor,
				);
			}
			expect(workflow.on?.workflow_call?.inputs ?? {}).not.toHaveProperty(
				"managed-comment-author",
			);
		}
	});

	it("authorizes dispatch only in the two officially locked jobs", async () => {
		const expected = [
			{
				job: "manage",
				mode: "dispatch",
				workflow: "update-meetup-issue",
			},
			{
				job: "audit",
				mode: "dispatch",
				workflow: "check-active-meetup-issues",
			},
		];

		for (const item of expected) {
			const workflow = await readWorkflow(item.workflow);
			const job = workflow.jobs?.[item.job] ?? {};
			const step = findStep(
				job,
				`${automationActionPrefix}communication/reconcile`,
			);
			expect(job.concurrency?.["cancel-in-progress"]).toBe(false);
			expect(step?.with?.mode).toBe(item.mode);
			expect(step?.with?.["dispatch-authorized"]).toBe("true");
		}
	});

	it("keeps scheduled audits code-owned and config-gated", async () => {
		const workflow = await readWorkflow("check-active-meetup-issues");
		const job = workflow.jobs?.audit ?? {};
		const token = (job.steps ?? []).find((step) => step.id === "app-token");
		const event = findStep(job, `${automationActionPrefix}event/reconcile`);
		const communication = findStep(
			job,
			`${automationActionPrefix}communication/reconcile`,
		);

		expect(sortedKeys(workflow.on?.workflow_call?.inputs)).toEqual([
			"github-app-id",
			"google-drive-meetup-folder-id",
			"google-drive-meetup-template-folder-id",
			"slack-channel-id",
		]);
		expect(token?.with?.["app-id"]).toBe(
			workflowExpression("inputs.github-app-id"),
		);
		expect(token?.with?.["permission-issues"]).toBe("write");
		expect(event?.with?.mode).toBe("check");
		expect(event?.id).toBe("event");
		expect(communication?.with?.mode).toBe("dispatch");
		expect(communication?.env?.SLACK_CHANNEL_ID).toBe(
			workflowExpression("inputs.slack-channel-id"),
		);
		const summary = (job.steps ?? []).find(
			(step) => step.name === "Add redacted audit summary",
		);
		expect(summary?.if).toBe("always()");
		expect(sortedKeys(summary?.env)).toEqual([
			"COMMUNICATION_DIAGNOSTICS",
			"COMMUNICATION_RESULT",
			"DISPATCHED_COUNT",
			"EVENT_DIAGNOSTICS",
			"EVENT_READY",
			"EVENT_RESULT",
			"EVENT_STATE",
			"ISSUE_NUMBER",
			"PLANNED_COUNT",
		]);
		expect(summary?.env?.EVENT_RESULT).toBe(
			workflowExpression("steps.event.outputs.result || '{}'"),
		);
		expect(summary?.env?.EVENT_DIAGNOSTICS).toBe(
			workflowExpression("steps.event.outputs.diagnostics || '[]'"),
		);
		expect(summary?.env?.COMMUNICATION_RESULT).toBe(
			workflowExpression("steps.communications.outputs.result || '{}'"),
		);
		expect(summary?.env?.COMMUNICATION_DIAGNOSTICS).toBe(
			workflowExpression("steps.communications.outputs.diagnostics || '[]'"),
		);
		expect(summary?.run).toContain("sanitize_json");
		expect(summary?.run).toContain("Redacted event result");
		expect(summary?.run).toContain("Redacted event diagnostics");
		expect(summary?.run).toContain("Redacted communication result");
		expect(summary?.run).toContain("Redacted communication diagnostics");
		expect(
			(job.steps ?? []).filter(
				(step) =>
					step.uses === `${automationActionPrefix}event/reconcile` &&
					step.with?.mode === "fix",
			),
		).toEqual([]);
	});

	it("blocks issue-form synchronization when referentials are invalid", async () => {
		const workflow = await readWorkflow("update-meetup-issue-form");
		const steps = workflow.jobs?.synchronize?.steps ?? [];
		const validation = findStep(
			workflow.jobs?.synchronize ?? {},
			`${automationActionPrefix}referential/validate`,
		);
		const enforcement = steps.find(
			(step) => step.name === "Enforce valid referentials",
		);
		const projection = findStep(
			workflow.jobs?.synchronize ?? {},
			`${automationActionPrefix}referential/sync-issue-form`,
		);

		expect(validation?.id).toBe("referentials");
		expect(enforcement?.if).toBe(
			"steps.referentials.outputs.is-valid != 'true'",
		);
		expect(enforcement?.run).toContain("exit 1");
		expect(steps.indexOf(enforcement as Step)).toBeLessThan(
			steps.indexOf(projection as Step),
		);
	});
});

describe("internal CI contracts", () => {
	it("routes main and pull-request CI through the shared workflow", async () => {
		const main = await readWorkflow("__main-ci");
		const pullRequest = await readWorkflow("__pull-request-ci");
		const shared = await readWorkflow("__shared-ci");
		const actionChecks = await readWorkflow("__check-actions");

		expect(main.jobs?.ci.uses).toBe("./.github/workflows/__shared-ci.yml");
		expect(pullRequest.jobs?.ci).toEqual(main.jobs?.ci);
		expect(shared.jobs?.["check-actions"]).toMatchObject({
			needs: ["check-nodejs", "check-dist"],
			uses: "./.github/workflows/__check-actions.yml",
			permissions: {
				contents: "read",
				issues: "write",
			},
		});

		const nodeChecks = await readWorkflow("__check-nodejs");
		const build = String(nodeChecks.jobs?.["test-nodejs"].with?.build ?? "");
		expect(build.split("\n")).toEqual(
			expect.arrayContaining(["workspace:build", "package"]),
		);
		expect(nodeChecks.jobs?.["test-nodejs"].with?.test).toContain("coverage");

		const workflowFiles = await readdir(join(root, ".github/workflows"));
		expect(
			workflowFiles.filter((name) =>
				/^__test-(?:action|workflow|component)/.test(name),
			),
		).toEqual([]);
		expect(workflowFiles).toContain("__main-ci.yml");
		expect(workflowFiles).toContain("__check-actions.yml");
		expect(workflowFiles).toContain("__pull-request-ci.yml");
		expect(workflowFiles).toContain("__greetings.yml");
		expect(workflowFiles).toContain("__need-fix-to-issue.yml");
		expect(workflowFiles).toContain("__semantic-pull-request.yml");
		expect(workflowFiles).toContain("__stale.yml");
		expect(workflowFiles).not.toContain("main-ci.yml");
		expect(workflowFiles).not.toContain("pull-request-ci.yml");
		expect(workflowFiles).not.toContain("greetings.yml");
		expect(workflowFiles).not.toContain("need-fix-to-issue.yml");
		expect(workflowFiles).not.toContain("semantic-pull-request.yml");
		expect(workflowFiles).not.toContain("stale.yml");
		expect(sortedKeys(actionChecks.jobs)).toEqual([
			"cleanup-synthetic-issue",
			"prepare-synthetic-issue",
			"test-communication-reconcile",
			"test-event-list-active",
			"test-event-reconcile",
			"test-publication-reconcile-assets",
			"test-referential-sync-issue-form",
			"test-referential-validate",
		]);
		expect(actionChecks.jobs?.["prepare-synthetic-issue"]?.permissions).toEqual(
			{
				contents: "read",
				issues: "write",
			},
		);
		expect(
			actionChecks.jobs?.["test-referential-validate"]?.permissions,
		).toEqual({
			contents: "read",
		});
		expect(
			actionChecks.jobs?.["test-referential-sync-issue-form"]?.permissions,
		).toEqual({
			contents: "read",
		});
		expect(actionChecks.jobs?.["test-event-list-active"]?.needs).toBe(
			"prepare-synthetic-issue",
		);
		expect(actionChecks.jobs?.["test-event-reconcile"]?.needs).toBe(
			"prepare-synthetic-issue",
		);
		expect(actionChecks.jobs?.["test-communication-reconcile"]?.needs).toBe(
			"prepare-synthetic-issue",
		);
		expect(actionChecks.jobs?.["cleanup-synthetic-issue"]?.needs).toEqual([
			"prepare-synthetic-issue",
			"test-event-list-active",
			"test-event-reconcile",
			"test-communication-reconcile",
		]);
		const dedicatedVitestGateOccurrences = (
			await Promise.all(
				workflowFiles
					.filter((name) => name.endsWith(".yml"))
					.map((name) =>
						readFile(join(root, ".github/workflows", name), "utf8"),
					),
			)
		).reduce(
			(count, source) =>
				count +
				(source.match(/\bcheck:(?:architecture|contracts)\b/g)?.length ?? 0),
			0,
		);
		expect(dedicatedVitestGateOccurrences).toBe(0);
	});

	it("delegates documentation updates to reusable release workflows", async () => {
		const workflow = await readWorkflow("__main-ci");
		const release = workflow.jobs?.release ?? {};
		const syncDocs = workflow.jobs?.["sync-docs"] ?? {};

		expect(release.needs).toBe("ci");
		expect(release.uses).toBe(
			"hoverkraft-tech/ci-github-publish/.github/workflows/release-actions.yml@ed354ada70b9f518c2bb663e18a80041c2cf5156",
		);
		expect(release.permissions).toEqual({
			contents: "write",
			"pull-requests": "write",
		});
		expect(release.with).toMatchObject({
			"github-app-client-id": workflowExpression("vars.CI_BOT_APP_CLIENT_ID"),
			"update-all": workflowExpression("startsWith(github.ref, 'refs/tags/')"),
		});
		expect(release.secrets).toMatchObject({
			"github-app-key": workflowExpression("secrets.CI_BOT_APP_PRIVATE_KEY"),
			"github-token": workflowExpression("secrets.GITHUB_TOKEN"),
		});

		expect(syncDocs.needs).toBe("release");
		expect(syncDocs.uses).toBe(
			"hoverkraft-tech/public-docs/.github/workflows/sync-docs-dispatcher.yml@f3c9291760d927e6214e8d5f0a376af2d537c369",
		);
		expect(syncDocs.if).toBe(
			"github.ref_name == github.event.repository.default_branch && vars.CI_BOT_APP_CLIENT_ID != '' && needs.release.outputs.artifact-id != ''",
		);
		expect(syncDocs.permissions).toEqual({ contents: "read" });
		expect(syncDocs.with).toMatchObject({
			"artifact-id": workflowExpression("needs.release.outputs.artifact-id"),
			"github-app-client-id": workflowExpression("vars.CI_BOT_APP_CLIENT_ID"),
		});
		expect(syncDocs.secrets).toMatchObject({
			"github-app-key": workflowExpression("secrets.CI_BOT_APP_PRIVATE_KEY"),
		});
	});
});
