import {
	createCommunicationIdempotencyKey,
	isSafeCommunicationIdentifier,
} from "./idempotency.js";
import {
	type CommunicationDiagnostic,
	type CommunicationIntent,
	type CommunicationKind,
	MAIL_TEMPLATE_NAMES,
	type MailMessageIntent,
	type MailRecipient,
	type MailTemplateName,
	type NotificationMessageIntent,
	type PlanCommunicationsInput,
	type PlanCommunicationsResult,
} from "./model.js";

type LocalDate = {
	readonly year: number;
	readonly month: number;
	readonly day: number;
};

type MailPolicy = {
	readonly kind: CommunicationKind;
	readonly templateName: MailTemplateName;
};

const MAIL_POLICIES = {
	introduction: {
		hosting: {
			kind: "host-introduction",
			templateName: MAIL_TEMPLATE_NAMES.hostIntroduction,
		},
		speaker: {
			kind: "speaker-introduction",
			templateName: MAIL_TEMPLATE_NAMES.speakerIntroduction,
		},
	},
	thanks: {
		hosting: {
			kind: "host-thanks",
			templateName: MAIL_TEMPLATE_NAMES.hostThanks,
		},
		speaker: {
			kind: "speaker-thanks",
			templateName: MAIL_TEMPLATE_NAMES.speakerThanks,
		},
	},
} as const satisfies Record<
	"introduction" | "thanks",
	Record<MailRecipient["role"], MailPolicy>
>;

export class PlanCommunications {
	execute(input: PlanCommunicationsInput): PlanCommunicationsResult {
		const diagnostics: CommunicationDiagnostic[] = [];

		if (!hasValidBaseIdentifiers(input)) {
			return {
				intents: [],
				diagnostics: [errorDiagnostic("invalid-identifier")],
			};
		}

		if (!isValidInstant(input.now)) {
			return {
				intents: [],
				diagnostics: [errorDiagnostic("invalid-clock")],
			};
		}

		if (
			input.occurrenceStatus === "cancelled" ||
			input.occurrenceStatus === "postponed"
		) {
			return { intents: [], diagnostics };
		}

		if (input.occurrenceStatus === "unknown") {
			return {
				intents: [],
				diagnostics: [warningDiagnostic("occurrence-status-unknown")],
			};
		}

		const eventDate = parseIsoLocalDate(input.eventDate);
		if (!eventDate) {
			return {
				intents: [],
				diagnostics: [errorDiagnostic("invalid-event-date")],
			};
		}

		const currentDate = getLocalDate(input.now, input.timeZone);
		if (!currentDate) {
			return {
				intents: [],
				diagnostics: [errorDiagnostic("invalid-time-zone")],
			};
		}

		const daysUntilEvent = toEpochDay(eventDate) - toEpochDay(currentDate);
		const intents: CommunicationIntent[] = [];
		if (input.occurrenceStatus === "held") {
			planMailMessages(input, "thanks", intents, diagnostics);
			return deduplicateIntents(intents, diagnostics);
		}

		// A scheduled event in the past is not evidence that it was held. It must
		// be explicitly transitioned before any occurrence-dependent mail is due.
		if (daysUntilEvent < 0) {
			return { intents: [], diagnostics };
		}

		if (input.readiness === "ready") {
			planMailMessages(input, "introduction", intents, diagnostics);
			return deduplicateIntents(intents, diagnostics);
		}

		if (
			!Number.isInteger(input.readinessWindowDays) ||
			input.readinessWindowDays < 0
		) {
			return {
				intents: [],
				diagnostics: [errorDiagnostic("invalid-readiness-window")],
			};
		}

		if (daysUntilEvent > input.readinessWindowDays) {
			return { intents: [], diagnostics };
		}

		planReadinessNotifications(input, intents, diagnostics);
		return deduplicateIntents(intents, diagnostics);
	}
}

function planMailMessages(
	input: PlanCommunicationsInput,
	policyName: keyof typeof MAIL_POLICIES,
	intents: CommunicationIntent[],
	diagnostics: CommunicationDiagnostic[],
): void {
	for (const recipient of input.mailRecipients) {
		if (!recipient.receivesCommunications) {
			continue;
		}

		if (!isSafeCommunicationIdentifier(recipient.recipientId)) {
			diagnostics.push(errorDiagnostic("invalid-identifier"));
			continue;
		}

		if (recipient.email.trim().length === 0) {
			diagnostics.push(errorDiagnostic("missing-mail-destination"));
			continue;
		}

		const policy = MAIL_POLICIES[policyName][recipient.role];
		const base = createIntentBase(input, policy.kind, recipient.recipientId);
		const intent: MailMessageIntent = {
			...base,
			channel: "mail",
			recipient: cloneMailRecipient(recipient),
			templateName: policy.templateName,
			placeholders: {
				...(input.mailPlaceholders ?? {}),
				...(recipient.placeholders ?? {}),
			},
		};
		intents.push(intent);
	}
}

function planReadinessNotifications(
	input: PlanCommunicationsInput,
	intents: CommunicationIntent[],
	diagnostics: CommunicationDiagnostic[],
): void {
	if (!input.notificationContent?.trim()) {
		diagnostics.push(errorDiagnostic("missing-notification-content"));
		return;
	}

	for (const recipient of input.notificationRecipients) {
		if (!recipient.receivesCommunications) {
			continue;
		}

		if (!isSafeCommunicationIdentifier(recipient.recipientId)) {
			diagnostics.push(errorDiagnostic("invalid-identifier"));
			continue;
		}

		if (recipient.destination.trim().length === 0) {
			diagnostics.push(errorDiagnostic("missing-notification-destination"));
			continue;
		}

		const base = createIntentBase(
			input,
			"readiness-reminder",
			recipient.recipientId,
		);
		const intent: NotificationMessageIntent = {
			...base,
			channel: "notification",
			recipient: { ...recipient },
			content: input.notificationContent,
		};
		intents.push(intent);
	}
}

function createIntentBase(
	input: PlanCommunicationsInput,
	kind: CommunicationKind,
	recipientId: string,
) {
	const idempotencyKey = createCommunicationIdempotencyKey({
		repositoryId: input.repositoryId,
		eventId: input.eventId,
		kind,
		recipientId,
		policyVersion: input.policyVersion,
	});

	return {
		intentId: idempotencyKey,
		idempotencyKey,
		repositoryId: input.repositoryId,
		eventId: input.eventId,
		policyVersion: input.policyVersion,
		kind,
		recipientId,
	} as const;
}

function cloneMailRecipient(recipient: MailRecipient): MailRecipient {
	return {
		...recipient,
		...(recipient.placeholders
			? { placeholders: { ...recipient.placeholders } }
			: {}),
	};
}

function deduplicateIntents(
	intents: readonly CommunicationIntent[],
	diagnostics: CommunicationDiagnostic[],
): PlanCommunicationsResult {
	const uniqueIntents = new Map<string, CommunicationIntent>();
	for (const intent of intents) {
		if (uniqueIntents.has(intent.idempotencyKey)) {
			diagnostics.push({
				...warningDiagnostic("duplicate-intent"),
				intentId: intent.intentId,
			});
			continue;
		}
		uniqueIntents.set(intent.idempotencyKey, intent);
	}

	return {
		intents: [...uniqueIntents.values()],
		diagnostics,
	};
}

function hasValidBaseIdentifiers(input: PlanCommunicationsInput): boolean {
	return [input.repositoryId, input.eventId, input.policyVersion].every(
		isSafeCommunicationIdentifier,
	);
}

function isValidInstant(value: Date): boolean {
	return value instanceof Date && Number.isFinite(value.getTime());
}

function parseIsoLocalDate(value: string): LocalDate | undefined {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) {
		return undefined;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const candidate = new Date(Date.UTC(year, month - 1, day));
	if (
		candidate.getUTCFullYear() !== year ||
		candidate.getUTCMonth() !== month - 1 ||
		candidate.getUTCDate() !== day
	) {
		return undefined;
	}

	return { year, month, day };
}

function getLocalDate(instant: Date, timeZone: string): LocalDate | undefined {
	try {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(instant);
		const values = new Map(parts.map((part) => [part.type, part.value]));
		const year = Number(values.get("year"));
		const month = Number(values.get("month"));
		const day = Number(values.get("day"));

		if (![year, month, day].every(Number.isInteger)) {
			return undefined;
		}

		return { year, month, day };
	} catch {
		return undefined;
	}
}

function toEpochDay(date: LocalDate): number {
	return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

function errorDiagnostic(
	code: CommunicationDiagnostic["code"],
): CommunicationDiagnostic {
	return { code, severity: "error" };
}

function warningDiagnostic(
	code: CommunicationDiagnostic["code"],
): CommunicationDiagnostic {
	return { code, severity: "warning" };
}
