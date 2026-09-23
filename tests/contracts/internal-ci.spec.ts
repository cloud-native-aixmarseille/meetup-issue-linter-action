import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	readWorkflow,
	root,
	sortedKeys,
	workflowExpression,
} from "./support.js";

describe("internal CI contracts", () => {
	it("routes main and pull-request CI through the shared workflow", async () => {
		// Arrange
		const workflowDirectory = join(root, ".github/workflows");

		// Act
		const main = await readWorkflow("__main-ci");
		const pullRequest = await readWorkflow("__pull-request-ci");
		const shared = await readWorkflow("__shared-ci");
		const actionChecks = await readWorkflow("__check-actions");
		const nodeChecks = await readWorkflow("__check-nodejs");
		const build = String(nodeChecks.jobs?.["test-nodejs"].with?.build ?? "");
		const workflowFiles = await readdir(workflowDirectory);
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

		// Assert
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
		expect(build.split("\n")).toEqual(
			expect.arrayContaining(["workspace:build", "package"]),
		);
		expect(nodeChecks.jobs?.["test-nodejs"].with?.test).toContain("coverage");
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
			"test-publication-reconcile-feedback",
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
		expect(dedicatedVitestGateOccurrences).toBe(0);
	});

	it("delegates documentation updates to reusable release workflows", async () => {
		// Arrange
		const workflow = await readWorkflow("__main-ci");

		// Act
		const release = workflow.jobs?.release ?? {};

		// Assert
		expect(release.needs).toBe("ci");
		expect(release.uses).toMatch(
			/^hoverkraft-tech\/ci-github-publish\/\.github\/workflows\/release-actions\.yml@[0-9a-f]{40}$/,
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
	});
});
