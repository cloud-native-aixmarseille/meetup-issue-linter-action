import { createHash } from "node:crypto";
import * as core from "@actions/core";
import { context } from "@actions/github";
import type { CommunicationDiagnostic } from "@meetup-automation/communication";
import { mapGitHubIssueDocument } from "@meetup-automation/github-event-repository";
import {
	AUTOMATION_CONFIG_PATH,
	type PublicDiagnostic,
	resultEnvelope,
} from "@meetup-automation/journey";
import { setDiagnosticsOutput, setJsonOutput } from "./action-output.js";
import {
	type CommunicationRuntimeDiagnostic,
	runCommunicationReconcile,
} from "./communication.js";
import {
	booleanInput,
	enumInput,
	positiveIntegerInput,
} from "./runtime-input.js";

export async function runCommunicationReconcileAction(): Promise<void> {
	const issueNumber = positiveIntegerInput(
		"issue-number",
		core.getInput("issue-number", { required: true }),
	);
	const requestedMode = enumInput(
		"mode",
		core.getInput("mode", { required: true }),
		["check", "dispatch"] as const,
	);
	const dispatchAuthorized = booleanInput(
		"dispatch-authorized",
		core.getInput("dispatch-authorized", { required: true }),
	);
	const { owner, repo } = context.repo;
	const issueSnapshot = context.payload.issue
		? (mapGitHubIssueDocument(context.payload.issue, `${owner}/${repo}`) ??
			undefined)
		: undefined;
	const outcome = await runCommunicationReconcile({
		issueNumber,
		configPath: AUTOMATION_CONFIG_PATH,
		requestedMode,
		dispatchAuthorized,
		githubToken: core.getInput("github-token", { required: true }),
		mailingsToken: core.getInput("mailings-token"),
		slackToken: core.getInput("slack-token"),
		slackChannelId: process.env.SLACK_CHANNEL_ID ?? "",
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
	const diagnostics = [
		...outcome.diagnostics.map(domainDiagnostic),
		...outcome.runtimeDiagnostics.map(runtimeDiagnostic),
	];

	setJsonOutput(
		"result",
		resultEnvelope(
			{
				mode: outcome.mode,
				counts: outcome.counts,
				intentIds: outcome.intentIds.map(publicIntentIdentifier),
			},
			diagnostics,
		),
	);
	core.setOutput("planned-count", String(outcome.counts.planned));
	core.setOutput("dispatched-count", String(outcome.counts.dispatched));
	setDiagnosticsOutput(diagnostics);
	if (diagnostics.some(({ severity }) => severity === "error")) {
		core.setFailed("Communication reconciliation failed; inspect diagnostics.");
	}
}

function publicIntentIdentifier(value: string): string {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function domainDiagnostic(
	diagnostic: CommunicationDiagnostic,
): PublicDiagnostic {
	return {
		code: `communication.${diagnostic.code}`,
		severity: diagnostic.severity,
		message: COMMUNICATION_MESSAGES[diagnostic.code],
	};
}

function runtimeDiagnostic(
	diagnostic: CommunicationRuntimeDiagnostic,
): PublicDiagnostic {
	return {
		code: diagnostic.code,
		severity: diagnostic.severity,
		message: RUNTIME_MESSAGES[diagnostic.code],
	};
}

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
	"missing-notification-destination":
		"The notification destination is unavailable.",
	"occurrence-status-unknown": "The event occurrence status must be explicit.",
	"delivery-already-recorded":
		"The delivery ledger already contains this intent.",
};

const RUNTIME_MESSAGES: Readonly<
	Record<CommunicationRuntimeDiagnostic["code"], string>
> = {
	"communication.dispatch-disabled-by-config":
		"Communication dispatch is disabled by repository configuration.",
	"communication.dispatch-not-authorized":
		"Communication dispatch is not authorized by the workflow lock.",
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
	"communication.mail-gateway-disabled-missing-credential":
		"Mail delivery is disabled because its credential is unavailable.",
	"communication.notification-gateway-disabled-missing-credential":
		"Notifications are disabled because their credential is unavailable.",
	"communication.notification-gateway-disabled-missing-destination":
		"Notifications are disabled because their destination is unavailable.",
	"communication.referential-catalog-invalid":
		"Communications are disabled because the referential catalog is invalid.",
};
