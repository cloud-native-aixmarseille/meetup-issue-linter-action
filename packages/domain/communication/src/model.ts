export const MAIL_TEMPLATE_NAMES = {
	hostIntroduction: "meetup-intro-hosting",
	speakerIntroduction: "meetup-intro-speakers",
	hostThanks: "meetup-thanks-hosting",
	speakerThanks: "meetup-thanks-speakers",
} as const;

export type MailTemplateName =
	(typeof MAIL_TEMPLATE_NAMES)[keyof typeof MAIL_TEMPLATE_NAMES];

export type CommunicationKind =
	| "host-introduction"
	| "speaker-introduction"
	| "readiness-reminder"
	| "host-thanks"
	| "speaker-thanks";

export type EventReadiness = "ready" | "not-ready";

export type EventOccurrenceStatus =
	| "scheduled"
	| "postponed"
	| "held"
	| "cancelled"
	| "unknown";

export type DeliveryStatus = "pending" | "accepted" | "uncertain" | "rejected";

export type ReconcileMode = "check" | "dispatch";

export type CommunicationDispatchCapabilities = Readonly<{
	mail: boolean;
	notification: boolean;
}>;

export type MailRecipientRole = "hosting" | "speaker";

type Recipient = {
	/**
	 * Stable, opaque identifier. It must not be a name, email address, or other
	 * contact data because it participates in the idempotency key.
	 */
	readonly recipientId: string;
	readonly receivesCommunications: boolean;
};

export type MailRecipient = Recipient & {
	readonly channel: "mail";
	readonly role: MailRecipientRole;
	readonly email: string;
	readonly placeholders?: Readonly<Record<string, string>>;
};

export type NotificationRecipient = Recipient & {
	readonly channel: "notification";
	readonly role: "organizers";
	readonly destination: string;
};

type CommunicationIntentBase = {
	readonly intentId: string;
	readonly idempotencyKey: string;
	readonly repositoryId: string;
	readonly eventId: string;
	readonly policyVersion: string;
	readonly kind: CommunicationKind;
	readonly recipientId: string;
};

export type MailMessageIntent = CommunicationIntentBase & {
	readonly channel: "mail";
	readonly recipient: MailRecipient;
	readonly templateName: MailTemplateName;
	readonly placeholders: Readonly<Record<string, string>>;
};

export type NotificationMessageIntent = CommunicationIntentBase & {
	readonly channel: "notification";
	readonly recipient: NotificationRecipient;
	readonly content: string;
};

export type CommunicationIntent = MailMessageIntent | NotificationMessageIntent;

export type CommunicationDiagnosticCode =
	| "duplicate-intent"
	| "gateway-delivery-uncertain"
	| "gateway-delivery-rejected"
	| "gateway-delivery-deferred"
	| "gateway-threw-ambiguous-error"
	| "invalid-clock"
	| "invalid-event-date"
	| "invalid-identifier"
	| "invalid-readiness-window"
	| "invalid-time-zone"
	| "ledger-read-failed"
	| "ledger-reservation-failed"
	| "ledger-status-write-failed"
	| "missing-mail-destination"
	| "missing-notification-content"
	| "missing-notification-destination"
	| "occurrence-status-unknown"
	| "delivery-already-recorded";

export type CommunicationDiagnostic = {
	readonly code: CommunicationDiagnosticCode;
	readonly severity: "info" | "warning" | "error";
	/** A deterministic, PII-free intent identifier. */
	readonly intentId?: string;
	readonly deliveryStatus?: DeliveryStatus;
	/** Adapter-provided machine code, accepted only when it is safe to report. */
	readonly detailCode?: string;
};

export type DeliveryLedgerEntry = {
	readonly idempotencyKey: string;
	readonly intentId: string;
	readonly status: DeliveryStatus;
	readonly updatedAt: string;
};

export type DeliveryReservation = {
	readonly idempotencyKey: string;
	readonly intentId: string;
	readonly repositoryId: string;
	readonly eventId: string;
	readonly kind: CommunicationKind;
	readonly recipientId: string;
	readonly policyVersion: string;
	readonly reservedAt: string;
};

export type DeliveryReservationResult =
	| {
			readonly reserved: true;
			readonly entry: DeliveryLedgerEntry & { readonly status: "pending" };
	  }
	| {
			readonly reserved: false;
			readonly entry: DeliveryLedgerEntry;
	  };

export type GatewayDiagnosticCode =
	| "ambiguous-response"
	| "connection-reset"
	| "provider-timeout"
	| "unknown-provider-state";

export type GatewayRejectionCode =
	| "authentication-failed"
	| "destination-unavailable"
	| "invalid-request"
	| "permission-denied";

export type GatewayRetryCode = "rate-limited";

export type GatewayDispatchResult =
	| { readonly outcome: "accepted" }
	| {
			readonly outcome: "uncertain";
			/** PII-free machine code, not an exception message. */
			readonly diagnosticCode?: GatewayDiagnosticCode;
	  }
	| {
			/** The provider definitively rejected the request before delivery. */
			readonly outcome: "rejected";
			readonly diagnosticCode: GatewayRejectionCode;
	  }
	| {
			/** The provider definitively did not accept the request; a later retry is safe. */
			readonly outcome: "deferred";
			readonly diagnosticCode: GatewayRetryCode;
	  };

export type PlanCommunicationsInput = {
	readonly repositoryId: string;
	readonly eventId: string;
	readonly eventDate: string;
	readonly timeZone: string;
	readonly readiness: EventReadiness;
	readonly occurrenceStatus: EventOccurrenceStatus;
	readonly policyVersion: string;
	readonly readinessWindowDays: number;
	readonly mailRecipients: readonly MailRecipient[];
	readonly notificationRecipients: readonly NotificationRecipient[];
	readonly mailPlaceholders?: Readonly<Record<string, string>>;
	readonly notificationContent?: string;
	/** Explicit instant. The planner never reads system time. */
	readonly now: Date;
};

export type PlanCommunicationsResult = {
	readonly intents: readonly CommunicationIntent[];
	readonly diagnostics: readonly CommunicationDiagnostic[];
};

export type ReconcileCommunicationsInput = Omit<
	PlanCommunicationsInput,
	"now"
> & {
	readonly mode: ReconcileMode;
	/** Runtime gateway availability; it never changes the business plan. */
	readonly dispatchCapabilities?: CommunicationDispatchCapabilities;
};

export type ReconcileCommunicationCounts = {
	readonly planned: number;
	readonly due: number;
	readonly alreadyRecorded: number;
	readonly reserved: number;
	/** Gateway calls made, regardless of their acknowledgement outcome. */
	readonly dispatched: number;
	readonly accepted: number;
	readonly uncertain: number;
	readonly rejected: number;
	readonly deferred: number;
};

export type ReconcileCommunicationsResult = {
	readonly mode: ReconcileMode;
	/** Safe identifiers only; message payloads and destinations are never returned. */
	readonly intentIds: readonly string[];
	readonly counts: ReconcileCommunicationCounts;
	readonly diagnostics: readonly CommunicationDiagnostic[];
};
