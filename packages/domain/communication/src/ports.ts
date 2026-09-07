import type { CommunicationApprovalSnapshot } from "./approval.js";
import type {
	DeliveryLedgerEntry,
	DeliveryReservation,
	DeliveryReservationResult,
	GatewayDispatchResult,
	MailMessageIntent,
	NotificationMessageIntent,
} from "./model.js";

export type CommunicationApprovalSaveResult = Readonly<{
	changed: boolean;
}>;

export interface CommunicationApprovalRepository {
	findApproved(
		eventId: string,
	): Promise<CommunicationApprovalSnapshot | undefined>;
	saveApproved(
		snapshot: CommunicationApprovalSnapshot,
	): Promise<CommunicationApprovalSaveResult>;
}

export interface CommunicationClock {
	now(): Date;
}

export interface DeliveryLedger {
	find(idempotencyKey: string): Promise<DeliveryLedgerEntry | undefined>;
	reservePending(
		reservation: DeliveryReservation,
	): Promise<DeliveryReservationResult>;
	markAccepted(idempotencyKey: string, acceptedAt: string): Promise<void>;
	markUncertain(
		idempotencyKey: string,
		uncertainAt: string,
		diagnosticCode: string,
	): Promise<void>;
	markRejected(
		idempotencyKey: string,
		rejectedAt: string,
		diagnosticCode: string,
	): Promise<void>;
	releasePending(idempotencyKey: string): Promise<void>;
}

export interface MailGateway {
	dispatch(message: MailMessageIntent): Promise<GatewayDispatchResult>;
}

export interface NotificationGateway {
	dispatch(message: NotificationMessageIntent): Promise<GatewayDispatchResult>;
}
