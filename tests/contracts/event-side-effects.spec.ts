import { describe, expect, it } from "vitest";
import {
	type ActionManifest,
	automationActionPrefix,
	findStep,
	managedAuthor,
	readWorkflow,
	readYaml,
	type Step,
	sortedKeys,
	workflowExpression,
} from "./support.js";

describe("event side-effect safeguards", () => {
	it.each([
		["update-meetup-issue", "manage"],
		["check-active-meetup-issues", "audit"],
	] as const)(
		"requires asset configuration and locks mutations in %s",
		async (name, jobName) => {
			// Arrange
			const actionPath = "actions/publication/reconcile-assets/action.yml";

			// Act
			const action = await readYaml<ActionManifest>(actionPath);
			const workflow = await readWorkflow(name);
			const job = workflow.jobs?.[jobName] ?? {};
			const step = findStep(
				job,
				`${automationActionPrefix}publication/reconcile-assets`,
			);

			// Assert
			for (const inputName of [
				"google-credentials",
				"google-drive-meetup-folder-id",
				"google-drive-meetup-template-folder-id",
			]) {
				expect(action.inputs?.[inputName]?.required).toBe(true);
				expect(action.inputs?.[inputName]?.default).toBeUndefined();
			}
			expect(job.concurrency?.["cancel-in-progress"]).toBe(false);
			expect(step?.with).not.toHaveProperty("mode");
			expect(step?.with).toMatchObject({
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
			).toBe(true);
			for (const inputName of [
				"google-drive-meetup-folder-id",
				"google-drive-meetup-template-folder-id",
			]) {
				expect(workflow.on?.workflow_call?.inputs?.[inputName]?.required).toBe(
					true,
				);
				expect(
					workflow.on?.workflow_call?.inputs?.[inputName]?.default,
				).toBeUndefined();
			}
		},
	);

	it("shares one non-cancelling event lock between issue and audit paths", async () => {
		// Arrange
		const manage = await readWorkflow("update-meetup-issue");
		const audit = await readWorkflow("check-active-meetup-issues");
		const manageLock = manage.jobs?.manage.concurrency;

		// Act
		const auditLock = audit.jobs?.audit.concurrency;

		// Assert
		expect(manageLock).toEqual({
			"cancel-in-progress": false,
			group: `meetup-event-${workflowExpression("github.repository_id")}-${workflowExpression("github.event.issue.number")}`,
		});
		expect(auditLock).toEqual({
			"cancel-in-progress": false,
			group: `meetup-event-${workflowExpression("github.repository_id")}-${workflowExpression("matrix.issue-number")}`,
		});
	});

	it.each([
		["update-meetup-issue", "manage"],
		["check-active-meetup-issues", "audit"],
	] as const)(
		"derives managed authors from the scoped token in %s",
		async (workflowName, jobName) => {
			// Arrange
			const actions = ["event/reconcile", "communication/reconcile"];

			// Act
			const workflow = await readWorkflow(workflowName);
			const job = workflow.jobs?.[jobName] ?? {};
			const appTokenIndex = (job.steps ?? []).findIndex(
				(step: Step) =>
					step.id === "app-token" &&
					step.uses?.startsWith("actions/create-github-app-token@"),
			);
			const actionSteps = actions.map((action) => {
				const stepIndex = (job.steps ?? []).findIndex(
					(step: Step) => step.uses === `${automationActionPrefix}${action}`,
				);
				return { stepIndex, step: job.steps?.[stepIndex] };
			});

			// Assert
			for (const { stepIndex, step } of actionSteps) {
				expect(stepIndex).toBeGreaterThan(appTokenIndex);
				expect(step?.with?.["managed-comment-author"]).toBe(managedAuthor);
			}
			expect(workflow.on?.workflow_call?.inputs ?? {}).not.toHaveProperty(
				"managed-comment-author",
			);
		},
	);

	it.each([
		{
			job: "manage",
			reportErrorsToIssue: "false",
			workflow: "update-meetup-issue",
		},
		{
			job: "audit",
			reportErrorsToIssue: "true",
			workflow: "check-active-meetup-issues",
		},
	] as const)(
		"reconciles communications under the event lock in $workflow",
		async (item) => {
			// Arrange
			// Use the shared fixtures.

			// Act
			const workflow = await readWorkflow(item.workflow);
			const job = workflow.jobs?.[item.job] ?? {};
			const step = findStep(
				job,
				`${automationActionPrefix}communication/reconcile`,
			);

			// Assert
			expect(job.concurrency?.["cancel-in-progress"]).toBe(false);
			expect(step?.with).not.toHaveProperty("mode");
			expect(step?.with).not.toHaveProperty("dispatch-authorized");
			expect(step?.with?.["report-errors-to-issue"]).toBe(
				item.reportErrorsToIssue,
			);
		},
	);

	it("keeps scheduled audits code-owned and config-gated", async () => {
		// Arrange
		const workflowName = "check-active-meetup-issues";

		// Act
		const workflow = await readWorkflow(workflowName);
		const job = workflow.jobs?.audit ?? {};
		const token = (job.steps ?? []).find(
			(step: Step) => step.id === "app-token",
		);
		const event = findStep(job, `${automationActionPrefix}event/reconcile`);
		const communication = findStep(
			job,
			`${automationActionPrefix}communication/reconcile`,
		);
		const summary = (job.steps ?? []).find((step: Step) =>
			step.run?.includes("GITHUB_STEP_SUMMARY"),
		);

		// Assert
		expect(sortedKeys(workflow.on?.workflow_call?.inputs)).toEqual([
			"github-app-client-id",
			"google-drive-meetup-folder-id",
			"google-drive-meetup-template-folder-id",
			"kutt-link-id",
			"locale",
			"slack-channel-id",
		]);
		expect(token?.with?.["client-id"]).toBe(
			workflowExpression("inputs.github-app-client-id"),
		);
		expect(token?.with?.["permission-issues"]).toBe("write");
		expect(event?.with?.mode).toBe("check");
		expect(event?.id).toBe("event");
		expect(communication?.with).not.toHaveProperty("mode");
		expect(communication?.with?.["report-errors-to-issue"]).toBe("true");
		expect(communication).not.toHaveProperty("continue-on-error");
		expect(communication?.with?.["slack-channel-id"]).toBe(
			workflowExpression("inputs.slack-channel-id"),
		);
		expect(summary).toBeUndefined();
		expect(
			(job.steps ?? []).filter(
				(step: Step) =>
					step.uses === `${automationActionPrefix}event/reconcile` &&
					step.with?.mode === "fix",
			),
		).toEqual([]);
	});

	it("requires successful actions before updating the issue form and opening a pull request", async () => {
		// Arrange
		const workflow = await readWorkflow("update-meetup-issue-form");
		const job = workflow.jobs?.synchronize ?? {};
		const steps = job.steps ?? [];

		// Act
		const validation = findStep(
			job,
			`${automationActionPrefix}referential/validate`,
		);
		const projection = findStep(
			job,
			`${automationActionPrefix}referential/sync-issue-form`,
		);
		const pullRequest = steps.find((step) =>
			step.uses?.startsWith("peter-evans/create-pull-request@"),
		);

		// Assert
		expect(validation?.id).toBe("referentials");
		expect(validation).not.toHaveProperty("continue-on-error");
		expect(projection?.id).toBe("synchronize");
		expect(projection?.with?.mode).toBe("fix");
		expect(projection?.if).toBeUndefined();
		expect(projection).not.toHaveProperty("continue-on-error");
		expect(steps.indexOf(validation as Step)).toBeLessThan(
			steps.indexOf(projection as Step),
		);
		expect(pullRequest?.if).toBe("steps.synchronize.outputs.changed == 'true'");
		expect(steps.indexOf(projection as Step)).toBeLessThan(
			steps.indexOf(pullRequest as Step),
		);
	});
});
