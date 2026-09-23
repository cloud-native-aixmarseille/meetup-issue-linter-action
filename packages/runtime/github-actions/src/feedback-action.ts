import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
	ManageMeetupFeedback,
	ResultEnvelopeFactory,
} from "@meetup-automation/journey";
import { ActionOutput } from "./action-output.js";
import type { ActionReportData } from "./action-report.js";
import { FeedbackComposition } from "./feedback-composition.js";
import { ActionMessages } from "./i18n/action-messages.js";
import { RuntimeInput } from "./runtime-input.js";

export class FeedbackAction {
	static async run(messages = new ActionMessages()): Promise<ActionReportData> {
		const issueNumber = RuntimeInput.positiveIntegerInput(
			"issue-number",
			core.getInput("issue-number", { required: true }),
		);
		const mode = RuntimeInput.enumInput(
			"mode",
			core.getInput("mode", { required: true }),
			["check", "fix"] as const,
		);
		const kuttApiKey = FeedbackAction.requiredInput("kutt-api-key");
		core.setSecret(kuttApiKey);
		const kuttLinkId = FeedbackAction.requiredInput("kutt-link-id");
		const openFeedbackApiKey = FeedbackAction.requiredInput(
			"openfeedback-api-key",
		);
		core.setSecret(openFeedbackApiKey);
		const { owner, repo } = context.repo;
		const container = FeedbackComposition.createFeedbackContainer({
			locale: messages.locale,
			client: getOctokit(core.getInput("github-token", { required: true })),
			owner,
			repo,
			commentAuthorLogin: core.getInput("managed-comment-author", {
				required: true,
			}),
			kuttApiKey,
			kuttLinkId,
			openFeedbackApiKey,
		});
		const outcome = await container.get(ManageMeetupFeedback).execute({
			identity: { repository: `${owner}/${repo}`, issueNumber },
			mode,
		});
		return FeedbackAction.report(issueNumber, mode, outcome, messages);
	}

	private static requiredInput(
		name: "kutt-api-key" | "kutt-link-id" | "openfeedback-api-key",
	): string {
		const value = core.getInput(name, { required: true });
		if (!value) throw new Error(`Input required and not supplied: ${name}`);
		return value;
	}

	private static report(
		issueNumber: number,
		mode: string,
		outcome: Awaited<ReturnType<ManageMeetupFeedback["execute"]>>,
		messages: ActionMessages,
	): ActionReportData {
		const { diagnostics, ...result } = outcome;
		ActionOutput.setJsonOutput(
			"result",
			ResultEnvelopeFactory.resultEnvelope(result, diagnostics),
		);
		core.setOutput("feedback-url", result.feedbackUrl ?? "");
		core.setOutput("link-updated", String(result.linkUpdated));
		return {
			details: [
				messages.t("report.event.context", { issue: issueNumber, mode }),
				result.skipped
					? messages.t("report.feedback.skipped")
					: messages.t("report.feedback.completed"),
				messages.t("report.feedback.changes", {
					persisted: String(result.persisted),
					linkUpdated: String(result.linkUpdated),
				}),
				messages.t("report.feedback.guidance"),
			],
			diagnostics,
		};
	}
}
