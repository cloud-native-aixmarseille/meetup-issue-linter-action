import type { getOctokit } from "@actions/github";
import { CsvReferentialRepository } from "@meetup-automation/csv-referential-repository";
import {
	createDefaultEventRules,
	type ReconcileEventDependencies,
} from "@meetup-automation/event";
import { GitHubEventCommentRepository } from "@meetup-automation/github-event-comment-repository";
import { GitHubEventRepository } from "@meetup-automation/github-event-repository";
import { GitHubIssueFormEventDocumentCodec } from "@meetup-automation/github-issue-form-event-document-codec";
import type { AutomationConfig } from "@meetup-automation/journey";
import { SystemEventClock } from "@meetup-automation/system-clock";
import { YamlAutomationConfigRepository } from "@meetup-automation/yaml-automation-config-repository";

export type GitHubClient = ReturnType<typeof getOctokit>;

export function workspaceConfigRepository(
	_workspaceRoot = process.cwd(),
): YamlAutomationConfigRepository {
	return new YamlAutomationConfigRepository();
}

export function createReferentialRepository(
	config: AutomationConfig,
	workspaceRoot = process.cwd(),
): CsvReferentialRepository {
	return new CsvReferentialRepository({
		workspaceRoot,
		hostsPath: config.referentials.hosts,
		speakersPath: config.referentials.speakers,
	});
}

export function createEventComposition(input: {
	client: GitHubClient;
	owner: string;
	repo: string;
	config: AutomationConfig;
	commentAuthorLogin: string;
}): ReconcileEventDependencies {
	const client = input.client as unknown as ConstructorParameters<
		typeof GitHubEventRepository
	>[0];
	const commentClient = input.client as unknown as ConstructorParameters<
		typeof GitHubEventCommentRepository
	>[0];
	return {
		repository: new GitHubEventRepository(client, {
			owner: input.owner,
			repo: input.repo,
		}),
		documentCodec: new GitHubIssueFormEventDocumentCodec({
			timeZone: input.config.timezone,
			hostConfirmationLabel:
				input.config.event["required-confirmation-labels"][0],
			speakersConfirmationLabel:
				input.config.event["required-confirmation-labels"][1],
		}),
		commentRepository: new GitHubEventCommentRepository(commentClient, {
			owner: input.owner,
			repo: input.repo,
			authorLogin: input.commentAuthorLogin,
		}),
		clock: new SystemEventClock(),
		rules: createDefaultEventRules({
			meetup: input.config.event["issue-label"],
			hostNeeded: "hoster:needed",
			hostConfirmed:
				input.config.event["required-confirmation-labels"][0] ??
				"hoster:confirmed",
			speakersNeeded: "speakers:needed",
			speakersConfirmed:
				input.config.event["required-confirmation-labels"][1] ??
				"speakers:confirmed",
			occurrencePostponed: "event:postponed",
			occurrenceHeld: "event:held",
			occurrenceCancelled: "event:cancelled",
		}),
	};
}
