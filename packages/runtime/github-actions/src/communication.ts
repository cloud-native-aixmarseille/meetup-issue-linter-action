import { createHash } from "node:crypto";
import { getOctokit } from "@actions/github";
import { CommunicationIdempotency } from "@meetup-automation/communication";
import type { EventDocument } from "@meetup-automation/event";
import {
	AutomationConfigFactory,
	type CommunicationJourneyDiagnostic,
	ManageMeetupCommunications,
	type ManageMeetupCommunicationsResult,
} from "@meetup-automation/journey";
import { CommunicationComposition } from "./communication-composition.js";
import { OrganizerNotificationMessages } from "./notifications/organizer-notification-messages.js";

export interface RunCommunicationReconcileInput {
	readonly locale?: string;
	readonly issueNumber: number;

	readonly githubToken: string;
	readonly mailingsToken: string;
	readonly slackToken: string;
	readonly slackChannelId: string;
	readonly owner: string;
	readonly repo: string;
	readonly repositoryId?: string;
	/** Caller revision which owns the private referentials. */
	readonly automationRevision: string;
	readonly workspaceRoot?: string;
	readonly managedCommentAuthor: string;
	readonly approvalTrigger?: Readonly<{
		action: string;
		label: string;
		actor: string;
		/** Immutable issue snapshot delivered with the GitHub label event. */
		issueSnapshot?: EventDocument;
	}>;
}

export type RunCommunicationReconcileResult = ManageMeetupCommunicationsResult;

export class CommunicationRuntime {
	/** Compose authenticated gateways before entering the application. */
	static async runCommunicationReconcile(
		input: RunCommunicationReconcileInput,
	): Promise<RunCommunicationReconcileResult> {
		CommunicationRuntime.assertInput(input);
		const config = AutomationConfigFactory.createAutomationConfig(input.owner);
		const runtimeDiagnostics: CommunicationJourneyDiagnostic[] = [];
		const githubToken = input.githubToken.trim();
		if (!githubToken) {
			ManageMeetupCommunications.isDispatchEnabled(config, runtimeDiagnostics);
			runtimeDiagnostics.push({
				code: "communication.github-credential-missing",
				severity: "error",
			});
			return ManageMeetupCommunications.emptyCommunicationResult(
				"check",
				runtimeDiagnostics,
			);
		}
		const mailingsToken = input.mailingsToken.trim();
		const slackToken = input.slackToken.trim();
		const slackChannelId = input.slackChannelId.trim();
		const messages = new OrganizerNotificationMessages(input.locale);
		const container = CommunicationComposition.createCommunicationContainer({
			locale: messages.locale,
			client: getOctokit(githubToken),
			owner: input.owner,
			repo: input.repo,
			issueNumber: input.issueNumber,
			commentAuthorLogin: input.managedCommentAuthor,
			config,
			workspaceRoot: input.workspaceRoot,
			mailingsToken,
			slackToken,
		});
		const result = await container.get(ManageMeetupCommunications).execute({
			issueNumber: input.issueNumber,
			owner: input.owner,
			repo: input.repo,
			repositoryId: input.repositoryId,
			automationRevision: input.automationRevision,
			notificationDestination: slackChannelId,
			notificationContent: messages.t("communication.organizer-attention", {
				issue: input.issueNumber,
			}),
			notificationContentRevision: messages.policyRevision,
			approvalTrigger: input.approvalTrigger,
			notificationDestinationFingerprint: config.communication["slack-enabled"]
				? `sha256:${createHash("sha256").update(slackChannelId).digest("hex")}`
				: null,
		});
		return result;
	}

	static assertInput(input: RunCommunicationReconcileInput): void {
		if (!Number.isSafeInteger(input.issueNumber) || input.issueNumber <= 0) {
			throw new Error("issueNumber must be a positive integer");
		}
		if (
			!CommunicationRuntime.isRepositoryPart(input.owner) ||
			!CommunicationRuntime.isRepositoryPart(input.repo)
		) {
			throw new Error(
				"owner and repo must be valid GitHub repository segments",
			);
		}
		if (!input.managedCommentAuthor.trim()) {
			throw new Error("managedCommentAuthor must not be empty");
		}
		if (
			!CommunicationIdempotency.isSafeCommunicationIdentifier(
				input.automationRevision.trim(),
			)
		) {
			throw new Error(
				"automationRevision must be a stable, PII-free revision identifier",
			);
		}
	}

	static isRepositoryPart(value: string): boolean {
		return /^[A-Za-z0-9_.-]+$/.test(value);
	}
}
