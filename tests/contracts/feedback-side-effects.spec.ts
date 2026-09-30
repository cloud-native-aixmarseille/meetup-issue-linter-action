import { describe, expect, it } from "vitest";
import {
	automationActionPrefix,
	findStep,
	managedAuthor,
	readWorkflow,
	workflowExpression,
} from "./support.js";

describe("feedback workflow safeguards", () => {
	it.each([
		["update-meetup-issue", "manage"],
		["check-active-meetup-issues", "audit"],
	] as const)(
		"requires OpenFeedback and Kutt configuration under the event lock in %s",
		async (name, jobName) => {
			// Arrange
			const workflow = await readWorkflow(name);
			const job = workflow.jobs?.[jobName] ?? {};

			// Act
			const step = findStep(
				job,
				`${automationActionPrefix}publication/reconcile-feedback`,
			);
			const secrets = workflow.on?.workflow_call?.secrets;

			// Assert
			expect(job.concurrency?.["cancel-in-progress"]).toBe(false);
			expect(secrets?.["openfeedback-api-key"]?.required).toBe(true);
			expect(secrets?.["kutt-api-key"]?.required).toBe(true);
			expect(
				workflow.on?.workflow_call?.inputs?.["kutt-link-id"]?.required,
			).toBe(true);
			expect(step?.with).not.toHaveProperty("mode");
			expect(step?.with).toMatchObject({
				locale: workflowExpression("inputs.locale"),
				"managed-comment-author": managedAuthor,
				"openfeedback-api-key": workflowExpression(
					"secrets.openfeedback-api-key",
				),
				"kutt-api-key": workflowExpression("secrets.kutt-api-key"),
				"kutt-link-id": workflowExpression("inputs.kutt-link-id"),
			});
		},
	);
});
