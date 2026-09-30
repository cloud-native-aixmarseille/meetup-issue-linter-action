import type { ReconcileCommunicationsResult } from "@meetup-automation/communication";
import type { EventDocument } from "@meetup-automation/event";

export interface ManageMeetupCommunicationsInput {
	readonly issueNumber: number;

	readonly notificationDestinationFingerprint: string | null;
	readonly notificationDestination: string;
	/** Rendered at the presentation boundary; never use this as an idempotency key. */
	readonly notificationContent: string;
	/** Empty preserves the original English approval policy. */
	readonly notificationContentRevision: string;
	readonly owner: string;
	readonly repo: string;
	readonly repositoryId?: string;
	/** Caller revision which owns the private referentials. */
	readonly automationRevision: string;
	readonly approvalTrigger?: Readonly<{
		action: string;
		label: string;
		actor: string;
		/** Immutable issue snapshot delivered with the GitHub label event. */
		issueSnapshot?: EventDocument;
	}>;
}

type CommunicationJourneyDiagnosticCode =
	| "communication.dispatch-disabled-by-config"
	| "communication.approval-label-missing"
	| "communication.approval-missing"
	| "communication.approval-stale"
	| "communication.approval-capture-unauthorized"
	| "communication.approval-trigger-snapshot-missing"
	| "communication.approval-trigger-stale"
	| "communication.approval-repository-failed"
	| "communication.event-skipped"
	| "communication.event-concurrently-modified"
	| "communication.event-references-unresolved"
	| "communication.github-credential-missing"
	| "communication.referential-catalog-invalid";

export interface CommunicationJourneyDiagnostic {
	readonly code: CommunicationJourneyDiagnosticCode;
	readonly severity: "info" | "warning" | "error";
}

export type ManageMeetupCommunicationsResult = ReconcileCommunicationsResult &
	Readonly<{
		runtimeDiagnostics: readonly CommunicationJourneyDiagnostic[];
	}>;
