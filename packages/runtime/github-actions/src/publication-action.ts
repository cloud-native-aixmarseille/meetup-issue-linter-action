import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
	ManageMeetupAssets,
	ResultEnvelopeFactory,
} from "@meetup-automation/journey";
import { ActionOutput } from "./action-output.js";
import type { ActionReportData } from "./action-report.js";
import { ActionMessages } from "./i18n/action-messages.js";
import { PublicationComposition } from "./publication-composition.js";
import { RuntimeInput } from "./runtime-input.js";

export class PublicationAction {
	static async runPublicationReconcileAssetsAction(
		messages = new ActionMessages(),
	): Promise<ActionReportData> {
		const issueNumber = RuntimeInput.positiveIntegerInput(
			"issue-number",
			core.getInput("issue-number", { required: true }),
		);
		const credentials = core.getInput("google-credentials", { required: true });
		core.setSecret(credentials);
		const client = getOctokit(
			core.getInput("github-token", { required: true }),
		);
		const commentAuthorLogin = core.getInput("managed-comment-author", {
			required: true,
		});
		const { owner, repo } = context.repo;
		const container = PublicationComposition.createPublicationContainer({
			locale: messages.locale,
			client,
			owner,
			repo,
			commentAuthorLogin,
			credentials,
			parentFolderId: core.getInput("google-drive-meetup-folder-id", {
				required: true,
			}),
			templateFolderId: core.getInput(
				"google-drive-meetup-template-folder-id",
				{
					required: true,
				},
			),
		});
		const outcome = await container.get(ManageMeetupAssets).execute({
			identity: { repository: `${owner}/${repo}`, issueNumber },
		});
		return PublicationAction.report(issueNumber, outcome, messages);
	}

	private static report(
		issueNumber: number,
		outcome: Awaited<ReturnType<ManageMeetupAssets["execute"]>>,
		messages: ActionMessages,
	): ActionReportData {
		ActionOutput.setJsonOutput(
			"result",
			ResultEnvelopeFactory.resultEnvelope(
				{
					skipped: outcome.skipped,
					persisted: outcome.persisted,
					assetUrl: outcome.assetUrl,
					files: outcome.files,
				},
				outcome.diagnostics,
			),
		);
		ActionOutput.setJsonOutput("drive-files", outcome.files);
		core.setOutput("asset-url", outcome.assetUrl ?? "");
		return {
			details: [
				messages.t("report.event.context", { issue: issueNumber, mode: "fix" }),
				outcome.skipped
					? messages.t("report.assets.skipped")
					: messages.t("report.assets.completed"),
				messages.t("report.assets.counts", {
					persisted: String(outcome.persisted),
					count: Object.keys(outcome.files).length,
				}),
			],
			diagnostics: outcome.diagnostics,
		};
	}
}
