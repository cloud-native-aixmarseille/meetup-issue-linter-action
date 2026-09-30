import { createHash } from "node:crypto";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import type { CommunicationDiagnostic } from "@meetup-automation/communication";
import { GitHubEventRepository } from "@meetup-automation/github-event-repository";
import type { CommunicationJourneyDiagnostic } from "@meetup-automation/journey";
import {
	type PublicDiagnostic,
	ResultEnvelopeFactory,
} from "@meetup-automation/journey";
import { ActionOutput } from "./action-output.js";
import type { ActionReportData } from "./action-report.js";
import { CommunicationRuntime } from "./communication.js";
import { CommunicationComposition } from "./communication-composition.js";
import { ActionMessages } from "./i18n/action-messages.js";
import { RuntimeInput } from "./runtime-input.js";

const COMMUNICATION_MESSAGES: Readonly<
	Record<CommunicationDiagnostic["code"], string>
> = {
	"duplicate-intent": "A duplicate communication intent was ignored.",
	"gateway-delivery-uncertain": "A gateway could not confirm delivery.",
	"gateway-delivery-rejected":
		"A gateway definitively rejected the delivery request.",
	"gateway-delivery-deferred":
		"A gateway deferred the request; a later retry remains safe.",
	"gateway-threw-ambiguous-error":
		"A gateway failed without a definitive delivery outcome.",
	"invalid-clock": "The communication clock is invalid.",
	"invalid-event-date": "The event date is invalid.",
	"invalid-identifier": "A stable communication identifier is invalid.",
	"invalid-readiness-window": "The readiness reminder window is invalid.",
	"invalid-time-zone": "The configured time zone is invalid.",
	"ledger-read-failed": "The delivery ledger could not be read.",
	"ledger-reservation-failed": "The delivery could not be reserved safely.",
	"ledger-status-write-failed": "The delivery status could not be recorded.",
	"missing-mail-destination": "An opted-in mail recipient has no destination.",
	"missing-notification-content": "Notification content is unavailable.",
	"occurrence-status-unknown": "The event occurrence status must be explicit.",
	"delivery-already-recorded":
		"The delivery ledger already contains this intent.",
};

const RUNTIME_MESSAGES: Readonly<
	Record<CommunicationJourneyDiagnostic["code"], string>
> = {
	"communication.dispatch-disabled-by-config":
		"Communication dispatch is disabled by repository configuration.",
	"communication.approval-label-missing":
		"Communications require the configured maintainer approval label.",
	"communication.approval-missing":
		"Communications require a maintainer-owned approval snapshot.",
	"communication.approval-stale":
		"Message-affecting event facts changed after approval; remove and re-add the approval label.",
	"communication.approval-capture-unauthorized":
		"The approval label actor does not have sufficient repository permission.",
	"communication.approval-trigger-snapshot-missing":
		"The approval label event did not contain an immutable issue snapshot.",
	"communication.approval-trigger-stale":
		"The issue changed after the approval label event; remove and re-add the approval label.",
	"communication.approval-repository-failed":
		"The maintainer approval record could not be verified safely.",
	"communication.event-skipped": "The issue is not a configured meetup event.",
	"communication.event-concurrently-modified":
		"The meetup issue changed while communications were being reconciled; no delivery was attempted.",
	"communication.event-references-unresolved":
		"Event participants could not be resolved to stable identifiers.",
	"communication.github-credential-missing":
		"The GitHub credential is unavailable.",
	"communication.referential-catalog-invalid":
		"Communications are disabled because the referential catalog is invalid.",
};

export class CommunicationAction {
	static async runCommunicationReconcileAction(
		messages = new ActionMessages(),
	): Promise<ActionReportData> {
		const reportErrorsToIssue = RuntimeInput.booleanInput(
			"report-errors-to-issue",
			core.getInput("report-errors-to-issue", { required: true }),
		);
		const issueNumber = RuntimeInput.positiveIntegerInput(
			"issue-number",
			core.getInput("issue-number", { required: true }),
		);
		const { owner, repo } = context.repo;
		const issueSnapshot = context.payload.issue
			? (GitHubEventRepository.mapGitHubIssueDocument(
					context.payload.issue,
					`${owner}/${repo}`,
				) ?? undefined)
			: undefined;
		const outcome = await CommunicationRuntime.runCommunicationReconcile({
			locale: messages.locale,
			issueNumber,

			githubToken: core.getInput("github-token", { required: true }),
			mailingsToken: core.getInput("mailings-token", { required: true }),
			slackToken: core.getInput("slack-token", { required: true }),
			slackChannelId: core.getInput("slack-channel-id", { required: true }),
			owner,
			repo,
			repositoryId: process.env.GITHUB_REPOSITORY_ID,
			automationRevision: process.env.GITHUB_SHA ?? "",
			managedCommentAuthor: core.getInput("managed-comment-author", {
				required: true,
			}),
			approvalTrigger: {
				action:
					typeof context.payload.action === "string"
						? context.payload.action
						: "",
				label:
					context.payload.label &&
					typeof context.payload.label === "object" &&
					"name" in context.payload.label &&
					typeof context.payload.label.name === "string"
						? context.payload.label.name
						: "",
				actor: context.actor,
				...(issueSnapshot ? { issueSnapshot } : {}),
			},
		});
		const report = CommunicationAction.report(outcome, messages);
		return reportErrorsToIssue
			? CommunicationAction.reportToIssue(issueNumber, report, messages)
			: report;
	}

	private static async reportToIssue(
		issueNumber: number,
		report: ActionReportData,
		messages: ActionMessages,
	): Promise<ActionReportData> {
		return CommunicationComposition.createIssueReport({
			...context.repo,
			issueNumber,
			locale: messages.locale,
			client: getOctokit(core.getInput("github-token", { required: true })),
			commentAuthorLogin: core.getInput("managed-comment-author", {
				required: true,
			}),
		}).reconcile(report);
	}

	static publicIntentIdentifier(value: string): string {
		return `sha256:${createHash("sha256").update(value).digest("hex")}`;
	}

	static domainDiagnostic(
		diagnostic: CommunicationDiagnostic,
	): PublicDiagnostic {
		return {
			code: `communication.${diagnostic.code}`,
			severity: diagnostic.severity,
			message: COMMUNICATION_MESSAGES[diagnostic.code],
		};
	}

	static runtimeDiagnostic(
		diagnostic: CommunicationJourneyDiagnostic,
	): PublicDiagnostic {
		return {
			code: diagnostic.code,
			severity: diagnostic.severity,
			message: RUNTIME_MESSAGES[diagnostic.code],
		};
	}

	private static report(
		outcome: Awaited<
			ReturnType<typeof CommunicationRuntime.runCommunicationReconcile>
		>,
		messages: ActionMessages,
	): ActionReportData {
		const diagnostics = [
			...outcome.diagnostics.map(CommunicationAction.domainDiagnostic),
			...outcome.runtimeDiagnostics.map(CommunicationAction.runtimeDiagnostic),
		];

		ActionOutput.setJsonOutput(
			"result",
			ResultEnvelopeFactory.resultEnvelope(
				{
					mode: outcome.mode,
					counts: outcome.counts,
					intentIds: outcome.intentIds.map(
						CommunicationAction.publicIntentIdentifier,
					),
				},
				diagnostics,
			),
		);
		core.setOutput("planned-count", String(outcome.counts.planned));
		core.setOutput("dispatched-count", String(outcome.counts.dispatched));
		return {
			details: [
				messages.t("report.communication.mode", { mode: outcome.mode }),
				messages.t("report.communication.planned", outcome.counts),
				messages.t("report.communication.accepted", {
					...outcome.counts,
					recorded: outcome.counts.alreadyRecorded,
				}),
				messages.t("report.communication.uncertain", outcome.counts),
				...(diagnostics.length > 0
					? [messages.t("report.communication.guidance")]
					: []),
				...(outcome.counts.uncertain > 0
					? [messages.t("report.communication.uncertain-guidance")]
					: []),
			],
			diagnostics,
			...(diagnostics.some(({ severity }) => severity === "error")
				? {
						failure: messages.t("report.communication.failed"),
					}
				: {}),
		};
	}
}
