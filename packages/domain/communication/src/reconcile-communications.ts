import type {
	CommunicationDiagnostic,
	CommunicationIntent,
	DeliveryLedgerEntry,
	GatewayDispatchResult,
	ReconcileCommunicationCounts,
	ReconcileCommunicationsInput,
	ReconcileCommunicationsResult,
} from "./model.js";
import type { PlanCommunications } from "./plan-communications.js";
import type {
	CommunicationClock,
	DeliveryLedger,
	MailGateway,
	NotificationGateway,
} from "./ports.js";

export type ReconcileCommunicationsDependencies = {
	readonly planner: PlanCommunications;
	readonly clock: CommunicationClock;
	readonly ledger: DeliveryLedger;
	readonly mailGateway: MailGateway;
	readonly notificationGateway: NotificationGateway;
};

type MutableCounts = {
	-readonly [Key in keyof ReconcileCommunicationCounts]: ReconcileCommunicationCounts[Key];
};

export class ReconcileCommunications {
	readonly #planner: PlanCommunications;
	readonly #clock: CommunicationClock;
	readonly #ledger: DeliveryLedger;
	readonly #mailGateway: MailGateway;
	readonly #notificationGateway: NotificationGateway;

	constructor(dependencies: ReconcileCommunicationsDependencies) {
		this.#planner = dependencies.planner;
		this.#clock = dependencies.clock;
		this.#ledger = dependencies.ledger;
		this.#mailGateway = dependencies.mailGateway;
		this.#notificationGateway = dependencies.notificationGateway;
	}

	async execute(
		input: ReconcileCommunicationsInput,
	): Promise<ReconcileCommunicationsResult> {
		let now: Date;
		try {
			now = this.#clock.now();
		} catch {
			return emptyResult(input.mode, {
				code: "invalid-clock",
				severity: "error",
			});
		}
		if (!isValidInstant(now)) {
			return emptyResult(input.mode, {
				code: "invalid-clock",
				severity: "error",
			});
		}

		const {
			mode,
			dispatchCapabilities = DEFAULT_DISPATCH_CAPABILITIES,
			...planningInput
		} = input;
		const plan = this.#planner.execute({ ...planningInput, now });
		const diagnostics = [...plan.diagnostics];
		const counts: MutableCounts = {
			planned: plan.intents.length,
			due: 0,
			alreadyRecorded: 0,
			reserved: 0,
			dispatched: 0,
			accepted: 0,
			uncertain: 0,
			rejected: 0,
			deferred: 0,
		};

		const timestamp = now.toISOString();

		for (const intent of plan.intents) {
			const existing = await this.#findExisting(intent, diagnostics);
			if (existing === "read-failed") {
				continue;
			}

			if (existing) {
				recordExisting(intent.intentId, existing, counts, diagnostics);
				continue;
			}

			counts.due += 1;
			if (mode === "check") {
				continue;
			}
			if (!dispatchCapabilities[intent.channel]) {
				continue;
			}

			const reservation = await this.#reserve(intent, timestamp, diagnostics);
			if (reservation === "reservation-failed") {
				continue;
			}

			if (!reservation.reserved) {
				recordExisting(intent.intentId, reservation.entry, counts, diagnostics);
				continue;
			}

			counts.reserved += 1;
			counts.dispatched += 1;
			await this.#dispatch(intent, timestamp, counts, diagnostics);
		}

		return result(mode, plan.intents, counts, diagnostics);
	}

	async #findExisting(
		intent: CommunicationIntent,
		diagnostics: CommunicationDiagnostic[],
	): Promise<DeliveryLedgerEntry | undefined | "read-failed"> {
		try {
			return await this.#ledger.find(intent.idempotencyKey);
		} catch {
			diagnostics.push({
				code: "ledger-read-failed",
				severity: "error",
				intentId: intent.intentId,
			});
			return "read-failed";
		}
	}

	async #reserve(
		intent: CommunicationIntent,
		timestamp: string,
		diagnostics: CommunicationDiagnostic[],
	) {
		try {
			return await this.#ledger.reservePending({
				idempotencyKey: intent.idempotencyKey,
				intentId: intent.intentId,
				repositoryId: intent.repositoryId,
				eventId: intent.eventId,
				kind: intent.kind,
				recipientId: intent.recipientId,
				policyVersion: intent.policyVersion,
				reservedAt: timestamp,
			});
		} catch {
			diagnostics.push({
				code: "ledger-reservation-failed",
				severity: "error",
				intentId: intent.intentId,
			});
			return "reservation-failed" as const;
		}
	}

	async #dispatch(
		intent: CommunicationIntent,
		timestamp: string,
		counts: MutableCounts,
		diagnostics: CommunicationDiagnostic[],
	): Promise<void> {
		let dispatchResult: GatewayDispatchResult;
		try {
			dispatchResult =
				intent.channel === "mail"
					? await this.#mailGateway.dispatch(intent)
					: await this.#notificationGateway.dispatch(intent);
		} catch {
			counts.uncertain += 1;
			diagnostics.push({
				code: "gateway-threw-ambiguous-error",
				severity: "error",
				intentId: intent.intentId,
			});
			await this.#markUncertain(
				intent,
				timestamp,
				"gateway-threw-ambiguous-error",
				diagnostics,
			);
			return;
		}

		if (dispatchResult.outcome === "deferred") {
			counts.deferred += 1;
			diagnostics.push({
				code: "gateway-delivery-deferred",
				severity: "warning",
				intentId: intent.intentId,
				detailCode: dispatchResult.diagnosticCode,
			});
			try {
				await this.#ledger.releasePending(intent.idempotencyKey);
			} catch {
				diagnostics.push({
					code: "ledger-status-write-failed",
					severity: "error",
					intentId: intent.intentId,
				});
			}
			return;
		}

		if (dispatchResult.outcome === "rejected") {
			counts.rejected += 1;
			diagnostics.push({
				code: "gateway-delivery-rejected",
				severity: "error",
				intentId: intent.intentId,
				detailCode: dispatchResult.diagnosticCode,
			});
			try {
				await this.#ledger.markRejected(
					intent.idempotencyKey,
					timestamp,
					dispatchResult.diagnosticCode,
				);
			} catch {
				diagnostics.push({
					code: "ledger-status-write-failed",
					severity: "error",
					intentId: intent.intentId,
				});
			}
			return;
		}

		if (dispatchResult.outcome === "uncertain") {
			const detailCode = safeDetailCode(dispatchResult.diagnosticCode);
			counts.uncertain += 1;
			diagnostics.push({
				code: "gateway-delivery-uncertain",
				severity: "error",
				intentId: intent.intentId,
				...(detailCode ? { detailCode } : {}),
			});
			await this.#markUncertain(
				intent,
				timestamp,
				detailCode ?? "gateway-delivery-uncertain",
				diagnostics,
			);
			return;
		}

		counts.accepted += 1;
		try {
			await this.#ledger.markAccepted(intent.idempotencyKey, timestamp);
		} catch {
			diagnostics.push({
				code: "ledger-status-write-failed",
				severity: "error",
				intentId: intent.intentId,
			});
		}
	}

	async #markUncertain(
		intent: CommunicationIntent,
		timestamp: string,
		diagnosticCode: string,
		diagnostics: CommunicationDiagnostic[],
	): Promise<void> {
		try {
			await this.#ledger.markUncertain(
				intent.idempotencyKey,
				timestamp,
				diagnosticCode,
			);
		} catch {
			diagnostics.push({
				code: "ledger-status-write-failed",
				severity: "error",
				intentId: intent.intentId,
			});
		}
	}
}

const DEFAULT_DISPATCH_CAPABILITIES = Object.freeze({
	mail: true,
	notification: true,
});

function recordExisting(
	intentId: string,
	entry: DeliveryLedgerEntry,
	counts: MutableCounts,
	diagnostics: CommunicationDiagnostic[],
): void {
	counts.alreadyRecorded += 1;
	diagnostics.push({
		code: "delivery-already-recorded",
		severity: "info",
		intentId,
		deliveryStatus: entry.status,
	});
}

function result(
	mode: ReconcileCommunicationsInput["mode"],
	intents: readonly CommunicationIntent[],
	counts: ReconcileCommunicationCounts,
	diagnostics: readonly CommunicationDiagnostic[],
): ReconcileCommunicationsResult {
	return {
		mode,
		intentIds: intents.map((intent) => intent.intentId),
		counts: { ...counts },
		diagnostics: [...diagnostics],
	};
}

function emptyResult(
	mode: ReconcileCommunicationsInput["mode"],
	diagnostic: CommunicationDiagnostic,
): ReconcileCommunicationsResult {
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
		diagnostics: [diagnostic],
	};
}

function isValidInstant(value: Date): boolean {
	return value instanceof Date && Number.isFinite(value.getTime());
}

function safeDetailCode(value: string | undefined): string | undefined {
	return [
		"ambiguous-response",
		"connection-reset",
		"provider-timeout",
		"unknown-provider-state",
	].includes(value ?? "")
		? value
		: undefined;
}
