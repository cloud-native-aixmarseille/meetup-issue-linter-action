import type { ReconcileCommunicationsResult } from "@meetup-automation/communication";
import {
	type EventDocument,
	type EventRepository,
	ReconcileEvent,
} from "@meetup-automation/event";
import type {
	CommunicationJourneyDiagnostic,
	ManageMeetupCommunicationsInput,
	ManageMeetupCommunicationsResult,
} from "../communication/contracts.js";
import { CommunicationApprovalResolver } from "../communication/resolve-communication-approval.js";
import type { AutomationConfig } from "../config/automation-config.js";
import { CommunicationDeliveryPreparation } from "./communication-delivery-preparation.js";
import { CommunicationPlaceholders } from "./communication-placeholders.js";
import type { ManageMeetupCommunicationsDependencies } from "./manage-meetup-communications-contracts.js";
import type { ManageMeetupEventResult } from "./manage-meetup-event-contracts.js";

/** Coordinate event readiness, approval and delivery through owned ports. */
export class ManageMeetupCommunications {
	constructor(
		private readonly dependencies: ManageMeetupCommunicationsDependencies,
	) {}

	async execute(
		input: ManageMeetupCommunicationsInput,
	): Promise<ManageMeetupCommunicationsResult> {
		const runtimeDiagnostics: CommunicationJourneyDiagnostic[] = [];
		const config = this.dependencies.config;
		const dispatchPermitted = ManageMeetupCommunications.isDispatchEnabled(
			config,
			runtimeDiagnostics,
		);
		const { sourceDocument, managed } = await this.loadEvent(input);

		if (managed.skipped) {
			return ManageMeetupCommunications.skippedResult(
				dispatchPermitted,
				runtimeDiagnostics,
			);
		}

		const delivery = await new CommunicationDeliveryPreparation(
			this.dependencies,
		).execute(input, managed.event, runtimeDiagnostics);
		const { referencesResolved } = delivery;

		if (
			dispatchPermitted &&
			referencesResolved &&
			!(await this.sourceIsCurrent(sourceDocument, runtimeDiagnostics))
		) {
			return ManageMeetupCommunications.emptyCommunicationResult(
				"check",
				runtimeDiagnostics,
			);
		}

		const communicationApproved = await this.approve(
			input,
			sourceDocument,
			managed,
			dispatchPermitted,
			referencesResolved,
			runtimeDiagnostics,
		);

		const dispatchEnabled =
			dispatchPermitted &&
			referencesResolved &&
			communicationApproved &&
			!runtimeDiagnostics.some(({ severity }) => severity === "error");

		if (
			dispatchEnabled &&
			!(await this.sourceIsCurrent(sourceDocument, runtimeDiagnostics))
		) {
			return ManageMeetupCommunications.emptyCommunicationResult(
				"check",
				runtimeDiagnostics,
			);
		}

		const reconciliation = await this.deliver(
			input,
			managed,
			delivery,
			dispatchEnabled,
		);

		return ManageMeetupCommunications.withRuntimeDiagnostics(
			reconciliation,
			runtimeDiagnostics,
		);
	}

	static isDispatchEnabled(
		config: AutomationConfig,
		diagnostics: CommunicationJourneyDiagnostic[],
	): boolean {
		const enabledByConfig = config.communication["dispatch-enabled"];
		if (!enabledByConfig) {
			diagnostics.push({
				code: "communication.dispatch-disabled-by-config",
				severity: "warning",
			});
		}
		return enabledByConfig;
	}

	private static async eventSourceIsCurrent(
		repository: EventRepository,
		expected: EventDocument,
		diagnostics: CommunicationJourneyDiagnostic[],
	): Promise<boolean> {
		try {
			const current = await repository.find(expected.identity);
			if (current && ReconcileEvent.eventDocumentsEqual(current, expected)) {
				return true;
			}
		} catch {
			// A failed consistency read is indistinguishable from a stale source here.
		}
		diagnostics.push({
			code: "communication.event-concurrently-modified",
			severity: "error",
		});
		return false;
	}

	private static withRuntimeDiagnostics(
		result: ReconcileCommunicationsResult,
		runtimeDiagnostics: readonly CommunicationJourneyDiagnostic[],
	): ManageMeetupCommunicationsResult {
		return {
			...result,
			runtimeDiagnostics: Object.freeze([...runtimeDiagnostics]),
		};
	}

	static emptyCommunicationResult(
		mode: "check" | "dispatch",
		runtimeDiagnostics: readonly CommunicationJourneyDiagnostic[],
	): ManageMeetupCommunicationsResult {
		return {
			mode,
			intentIds: [],
			counts: {
				planned: 0,
				due: 0,
				alreadyRecorded: 0,
				reserved: 0,
				dispatched: 0,
				accepted: 0,
				uncertain: 0,
				rejected: 0,
				deferred: 0,
			},
			diagnostics: [],
			runtimeDiagnostics: Object.freeze([...runtimeDiagnostics]),
		};
	}

	private async loadEvent(input: ManageMeetupCommunicationsInput) {
		const repositoryName = `${input.owner}/${input.repo}`;
		const identity = {
			repository: repositoryName,
			issueNumber: input.issueNumber,
		} as const;
		const sourceDocument =
			await this.dependencies.eventRepository.find(identity);
		if (!sourceDocument) {
			throw new Error(
				`Meetup event ${repositoryName}#${input.issueNumber} was not found`,
			);
		}
		const managed = await this.dependencies.manageEvent.execute({
			identity,
			mode: "check",
			sourceDocument,
		});

		return { identity, sourceDocument, managed };
	}
	private async approve(
		input: ManageMeetupCommunicationsInput,
		sourceDocument: EventDocument,
		managed: Exclude<ManageMeetupEventResult, { skipped: true }>,
		dispatchPermitted: boolean,
		referencesResolved: boolean,
		runtimeDiagnostics: CommunicationJourneyDiagnostic[],
	) {
		const config = this.dependencies.config;
		const communicationApproved = referencesResolved
			? await CommunicationApprovalResolver.resolveCommunicationApproval({
					input,
					config,
					repository: this.dependencies.approvalRepository,
					actorCanApprove: this.dependencies.actorCanApprove,
					captureApproval: dispatchPermitted,
					sourceDocument,
					event: managed.event,
					readiness: managed.isReady ? "ready" : "not-ready",
					notificationDestinationFingerprint:
						input.notificationDestinationFingerprint,
					diagnostics: runtimeDiagnostics,
				})
			: false;
		return communicationApproved;
	}
	private async deliver(
		input: ManageMeetupCommunicationsInput,
		managed: Exclude<ManageMeetupEventResult, { skipped: true }>,
		delivery: Awaited<ReturnType<CommunicationDeliveryPreparation["execute"]>>,
		dispatchEnabled: boolean,
	) {
		const config = this.dependencies.config;
		const repositoryName = `${input.owner}/${input.repo}`;
		const reconciliation = await this.dependencies
			.reconcileCommunications(dispatchEnabled)
			.execute({
				mode: dispatchEnabled ? "dispatch" : "check",
				dispatchCapabilities: {
					mail: true,
					notification: delivery.notificationConfigured,
				},
				repositoryId: input.repositoryId?.trim() || repositoryName,
				eventId: `issue-${input.issueNumber}`,
				eventDate: managed.event.date,
				timeZone: config.timezone,
				readiness: managed.isReady ? "ready" : "not-ready",
				occurrenceStatus: managed.event.occurrenceStatus ?? "unknown",
				policyVersion: String(config.communication["policy-version"]),
				readinessWindowDays: config.communication["readiness-window-days"],
				mailRecipients: delivery.mailRecipientResolution.recipients,
				notificationRecipients: delivery.notificationRecipients,
				mailPlaceholders: CommunicationPlaceholders.eventPlaceholders(
					managed.event,
				),
				notificationContent: input.notificationContent,
			});

		return reconciliation;
	}

	private sourceIsCurrent(
		source: EventDocument,
		diagnostics: CommunicationJourneyDiagnostic[],
	) {
		return ManageMeetupCommunications.eventSourceIsCurrent(
			this.dependencies.eventRepository,
			source,
			diagnostics,
		);
	}

	private static skippedResult(
		dispatchPermitted: boolean,
		runtimeDiagnostics: CommunicationJourneyDiagnostic[],
	) {
		runtimeDiagnostics.push({
			code: "communication.event-skipped",
			severity: "info",
		});
		return ManageMeetupCommunications.emptyCommunicationResult(
			dispatchPermitted ? "dispatch" : "check",
			runtimeDiagnostics,
		);
	}
}
