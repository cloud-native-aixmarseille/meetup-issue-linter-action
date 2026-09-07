import { createHash } from "node:crypto";
import type {
	DeliveryLedger,
	DeliveryLedgerEntry,
	DeliveryReservation,
	DeliveryReservationResult,
} from "@meetup-automation/communication";

export const DELIVERY_LEDGER_MARKER =
	"<!-- meetup-automation-delivery-ledger:v1 -->";

export interface GithubLedgerComment {
	id: number;
	body: string;
	authorLogin?: string;
}

export interface GithubLedgerCommentClient {
	listComments(): Promise<readonly GithubLedgerComment[]>;
	createComment(body: string): Promise<void>;
	updateComment(commentId: number, body: string): Promise<void>;
}

interface StoredEntry extends DeliveryLedgerEntry {
	repositoryId: string;
	eventId: string;
	kind: DeliveryReservation["kind"];
	recipientId: string;
	policyVersion: string;
	diagnosticCode?: string;
}

interface StoredLedger {
	schemaVersion: 2;
	entries: StoredEntry[];
}

export interface GithubDeliveryLedgerOptions {
	dispatchAuthorized: boolean;
	/** Only comments owned by this trusted automation identity form the ledger. */
	authorLogin: string;
}

export class GithubDeliveryLedger implements DeliveryLedger {
	readonly #authorLogin: string;

	constructor(
		private readonly comments: GithubLedgerCommentClient,
		private readonly options: GithubDeliveryLedgerOptions,
	) {
		this.#authorLogin = options.authorLogin.trim().toLowerCase();
		if (!this.#authorLogin) {
			throw new Error("Delivery ledger author login is required");
		}
	}

	async find(idempotencyKey: string): Promise<DeliveryLedgerEntry | undefined> {
		const { ledger } = await this.#load();
		const protectedKey = protectIdentifier(idempotencyKey);
		const entry = ledger.entries.find(
			(candidate) => candidate.idempotencyKey === protectedKey,
		);
		return entry ? publicEntry(entry) : undefined;
	}

	async reservePending(
		reservation: DeliveryReservation,
	): Promise<DeliveryReservationResult> {
		this.#assertDispatchAuthorized();
		const state = await this.#load();
		const protectedKey = protectIdentifier(reservation.idempotencyKey);
		const existing = state.ledger.entries.find(
			(entry) => entry.idempotencyKey === protectedKey,
		);
		if (existing) {
			return { reserved: false, entry: publicEntry(existing) };
		}

		const entry: StoredEntry = {
			idempotencyKey: protectedKey,
			intentId: protectIdentifier(reservation.intentId),
			repositoryId: protectIdentifier(reservation.repositoryId),
			eventId: protectIdentifier(reservation.eventId),
			kind: reservation.kind,
			recipientId: protectIdentifier(reservation.recipientId),
			policyVersion: reservation.policyVersion,
			status: "pending",
			updatedAt: reservation.reservedAt,
		};
		state.ledger.entries.push(entry);
		await this.#save(state.commentId, state.ledger);
		return {
			reserved: true,
			entry: { ...publicEntry(entry), status: "pending" },
		};
	}

	async markAccepted(
		idempotencyKey: string,
		acceptedAt: string,
	): Promise<void> {
		await this.#transition(idempotencyKey, "accepted", acceptedAt);
	}

	async markUncertain(
		idempotencyKey: string,
		uncertainAt: string,
		diagnosticCode: string,
	): Promise<void> {
		await this.#transition(
			idempotencyKey,
			"uncertain",
			uncertainAt,
			diagnosticCode,
		);
	}

	async markRejected(
		idempotencyKey: string,
		rejectedAt: string,
		diagnosticCode: string,
	): Promise<void> {
		await this.#transition(
			idempotencyKey,
			"rejected",
			rejectedAt,
			diagnosticCode,
		);
	}

	async releasePending(idempotencyKey: string): Promise<void> {
		this.#assertDispatchAuthorized();
		const state = await this.#load();
		const protectedKey = protectIdentifier(idempotencyKey);
		const index = state.ledger.entries.findIndex(
			(entry) => entry.idempotencyKey === protectedKey,
		);
		if (index < 0 || state.ledger.entries[index]?.status !== "pending") {
			throw new Error("Cannot release a delivery that is not pending");
		}
		state.ledger.entries.splice(index, 1);
		await this.#save(state.commentId, state.ledger);
	}

	async #transition(
		idempotencyKey: string,
		status: "accepted" | "uncertain" | "rejected",
		updatedAt: string,
		diagnosticCode?: string,
	): Promise<void> {
		this.#assertDispatchAuthorized();
		const state = await this.#load();
		const protectedKey = protectIdentifier(idempotencyKey);
		const index = state.ledger.entries.findIndex(
			(entry) => entry.idempotencyKey === protectedKey,
		);
		if (index < 0) {
			throw new Error("Cannot transition a delivery that was not reserved");
		}
		const current = state.ledger.entries[index];
		if (!current) {
			throw new Error("Delivery ledger index is invalid");
		}
		state.ledger.entries[index] = {
			...current,
			status,
			updatedAt,
			...(diagnosticCode ? { diagnosticCode: safeCode(diagnosticCode) } : {}),
		};
		await this.#save(state.commentId, state.ledger);
	}

	async #load(): Promise<{ commentId?: number; ledger: StoredLedger }> {
		const matching = (await this.comments.listComments()).filter(
			(comment) =>
				comment.body.startsWith(DELIVERY_LEDGER_MARKER) &&
				comment.authorLogin?.trim().toLowerCase() === this.#authorLogin,
		);
		if (matching.length > 1) {
			throw new Error("Multiple managed delivery ledger comments found");
		}
		const comment = matching[0];
		if (!comment) {
			return { ledger: { schemaVersion: 2, entries: [] } };
		}
		return { commentId: comment.id, ledger: parseLedger(comment.body) };
	}

	async #save(
		commentId: number | undefined,
		ledger: StoredLedger,
	): Promise<void> {
		ledger.entries.sort((left, right) =>
			left.idempotencyKey.localeCompare(right.idempotencyKey),
		);
		const body = renderLedger(ledger);
		if (commentId === undefined) {
			await this.comments.createComment(body);
			return;
		}
		await this.comments.updateComment(commentId, body);
	}

	#assertDispatchAuthorized(): void {
		if (!this.options.dispatchAuthorized) {
			throw new Error(
				"Delivery ledger writes require the reusable workflow concurrency lock",
			);
		}
	}
}

function parseLedger(body: string): StoredLedger {
	const match = body.match(/```json\s*([\s\S]*?)\s*```/);
	if (!match?.[1]) {
		throw new Error("Managed delivery ledger comment is corrupted");
	}
	const value = JSON.parse(match[1]) as {
		schemaVersion?: unknown;
		entries?: unknown;
	};
	if (
		(value.schemaVersion !== 1 && value.schemaVersion !== 2) ||
		!Array.isArray(value.entries)
	) {
		throw new Error("Managed delivery ledger schema is unsupported");
	}
	for (const entry of value.entries) {
		if (!isStoredEntry(entry)) {
			throw new Error("Managed delivery ledger entry is corrupted");
		}
	}
	return {
		schemaVersion: 2,
		entries: value.entries.map(protectStoredEntry),
	};
}

function renderLedger(ledger: StoredLedger): string {
	return `${DELIVERY_LEDGER_MARKER}\n\n<details><summary>Meetup communication delivery ledger</summary>\n\n\`\`\`json\n${JSON.stringify(ledger, null, 2)}\n\`\`\`\n\n</details>`;
}

function publicEntry(entry: StoredEntry): DeliveryLedgerEntry {
	return {
		idempotencyKey: entry.idempotencyKey,
		intentId: entry.intentId,
		status: entry.status,
		updatedAt: entry.updatedAt,
	};
}

function isStoredEntry(value: unknown): value is StoredEntry {
	if (!value || typeof value !== "object") return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.idempotencyKey === "string" &&
		typeof entry.intentId === "string" &&
		["pending", "accepted", "uncertain", "rejected"].includes(
			String(entry.status),
		) &&
		typeof entry.updatedAt === "string" &&
		typeof entry.repositoryId === "string" &&
		typeof entry.eventId === "string" &&
		typeof entry.kind === "string" &&
		typeof entry.recipientId === "string" &&
		typeof entry.policyVersion === "string"
	);
}

function safeCode(code: string): string {
	return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(code)
		? code
		: "unsafe-diagnostic-code-redacted";
}

function protectStoredEntry(entry: StoredEntry): StoredEntry {
	return {
		...entry,
		idempotencyKey: protectIdentifier(entry.idempotencyKey),
		intentId: protectIdentifier(entry.intentId),
		repositoryId: protectIdentifier(entry.repositoryId),
		eventId: protectIdentifier(entry.eventId),
		recipientId: protectIdentifier(entry.recipientId),
	};
}

function protectIdentifier(value: string): string {
	if (/^sha256:[0-9a-f]{64}$/.test(value)) {
		return value;
	}
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
