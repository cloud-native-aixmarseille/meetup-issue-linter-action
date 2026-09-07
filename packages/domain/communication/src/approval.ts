import { isSafeCommunicationIdentifier } from "./idempotency.js";
import type { EventOccurrenceStatus, EventReadiness } from "./model.js";

export const COMMUNICATION_APPROVAL_SCHEMA_VERSION = 1 as const;

export type CommunicationApprovalPublicationUrls = Readonly<{
	meetup: string | null;
	community: string | null;
	assets: string | null;
}>;

export type CommunicationApprovalConfirmations = Readonly<{
	host: boolean;
	speakers: boolean;
}>;

/**
 * PII-free facts which can change message eligibility, recipients, routes, or
 * provider payloads. Referential contact fields deliberately do not belong in
 * this type: the checked-out automation revision binds those private values
 * without copying or hashing PII into the public approval record.
 */
export type CommunicationApprovalFacts = Readonly<{
	automationRevision: string;
	eventId: string;
	eventDate: string;
	occurrenceStatus: EventOccurrenceStatus;
	readiness: EventReadiness;
	policyVersion: string;
	mailingsRepository: string;
	notificationEnabled: boolean;
	notificationDestinationFingerprint: string | null;
	confirmations: CommunicationApprovalConfirmations;
	hostId: string | null;
	speakerIds: readonly string[];
	publicationUrls: CommunicationApprovalPublicationUrls;
}>;

export type CommunicationApprovalSnapshot = Readonly<{
	schemaVersion: typeof COMMUNICATION_APPROVAL_SCHEMA_VERSION;
	facts: CommunicationApprovalFacts;
}>;

export class CommunicationApprovalSnapshotError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CommunicationApprovalSnapshotError";
	}
}

/**
 * Create the canonical approval representation. Speaker identity is a set, so
 * IDs are trimmed, deduplicated, and sorted. Public URLs are trimmed and have
 * one trailing slash removed, matching event/publication normalization.
 */
export function createCommunicationApprovalSnapshot(
	facts: CommunicationApprovalFacts,
): CommunicationApprovalSnapshot {
	return Object.freeze({
		schemaVersion: COMMUNICATION_APPROVAL_SCHEMA_VERSION,
		facts: normalizeFacts(facts),
	});
}

/**
 * Compare approval-bound facts. Speaker ordering and duplicate agenda
 * appearances do not invalidate approval; every other normalized fact must be
 * exactly equal.
 */
export function communicationApprovalFactsEqual(
	left: CommunicationApprovalFacts,
	right: CommunicationApprovalFacts,
): boolean {
	try {
		return factsKey(normalizeFacts(left)) === factsKey(normalizeFacts(right));
	} catch {
		return false;
	}
}

export function communicationApprovalMatches(
	approved: CommunicationApprovalSnapshot | undefined,
	currentFacts: CommunicationApprovalFacts,
): boolean {
	return (
		approved?.schemaVersion === COMMUNICATION_APPROVAL_SCHEMA_VERSION &&
		communicationApprovalFactsEqual(approved.facts, currentFacts)
	);
}

/** Parse a strict, technology-independent representation from an adapter. */
export function parseCommunicationApprovalSnapshot(
	value: unknown,
): CommunicationApprovalSnapshot {
	if (!isExactRecord(value, ["schemaVersion", "facts"])) {
		throw invalidSnapshot();
	}
	if (value.schemaVersion !== COMMUNICATION_APPROVAL_SCHEMA_VERSION) {
		throw invalidSnapshot();
	}
	if (
		!isExactRecord(value.facts, [
			"automationRevision",
			"eventId",
			"eventDate",
			"occurrenceStatus",
			"readiness",
			"policyVersion",
			"mailingsRepository",
			"notificationEnabled",
			"notificationDestinationFingerprint",
			"confirmations",
			"hostId",
			"speakerIds",
			"publicationUrls",
		])
	) {
		throw invalidSnapshot();
	}
	const facts = value.facts;
	if (!isExactRecord(facts.confirmations, ["host", "speakers"])) {
		throw invalidSnapshot();
	}
	if (
		!isExactRecord(facts.publicationUrls, ["meetup", "community", "assets"])
	) {
		throw invalidSnapshot();
	}
	if (
		typeof facts.automationRevision !== "string" ||
		typeof facts.eventId !== "string" ||
		typeof facts.eventDate !== "string" ||
		!isOccurrenceStatus(facts.occurrenceStatus) ||
		!isReadiness(facts.readiness) ||
		typeof facts.policyVersion !== "string" ||
		typeof facts.mailingsRepository !== "string" ||
		typeof facts.notificationEnabled !== "boolean" ||
		!isNullableString(facts.notificationDestinationFingerprint) ||
		typeof facts.confirmations.host !== "boolean" ||
		typeof facts.confirmations.speakers !== "boolean" ||
		(facts.hostId !== null && typeof facts.hostId !== "string") ||
		!Array.isArray(facts.speakerIds) ||
		!facts.speakerIds.every((id) => typeof id === "string") ||
		!isNullableString(facts.publicationUrls.meetup) ||
		!isNullableString(facts.publicationUrls.community) ||
		!isNullableString(facts.publicationUrls.assets)
	) {
		throw invalidSnapshot();
	}

	return createCommunicationApprovalSnapshot({
		automationRevision: facts.automationRevision,
		eventId: facts.eventId,
		eventDate: facts.eventDate,
		occurrenceStatus: facts.occurrenceStatus,
		readiness: facts.readiness,
		policyVersion: facts.policyVersion,
		mailingsRepository: facts.mailingsRepository,
		notificationEnabled: facts.notificationEnabled,
		notificationDestinationFingerprint:
			facts.notificationDestinationFingerprint,
		confirmations: {
			host: facts.confirmations.host,
			speakers: facts.confirmations.speakers,
		},
		hostId: facts.hostId,
		speakerIds: facts.speakerIds,
		publicationUrls: {
			meetup: facts.publicationUrls.meetup,
			community: facts.publicationUrls.community,
			assets: facts.publicationUrls.assets,
		},
	});
}

function normalizeFacts(
	facts: CommunicationApprovalFacts,
): CommunicationApprovalFacts {
	const automationRevision = requireSafeIdentifier(
		facts.automationRevision,
		"automationRevision",
	);
	const eventId = requireSafeIdentifier(facts.eventId, "eventId");
	const eventDate = requireIsoDate(facts.eventDate);
	if (!isOccurrenceStatus(facts.occurrenceStatus)) {
		throw new CommunicationApprovalSnapshotError(
			"occurrenceStatus must be a supported event status",
		);
	}
	if (!isReadiness(facts.readiness)) {
		throw new CommunicationApprovalSnapshotError(
			"readiness must be ready or not-ready",
		);
	}
	const policyVersion = requireSafeIdentifier(
		facts.policyVersion,
		"policyVersion",
	);
	const mailingsRepository = requireSafeIdentifier(
		facts.mailingsRepository,
		"mailingsRepository",
	);
	if (typeof facts.notificationEnabled !== "boolean") {
		throw new CommunicationApprovalSnapshotError(
			"notificationEnabled must be a boolean",
		);
	}
	const notificationDestinationFingerprint =
		facts.notificationDestinationFingerprint === null
			? null
			: requireSha256Fingerprint(
					facts.notificationDestinationFingerprint,
					"notificationDestinationFingerprint",
				);
	if (
		!facts.notificationEnabled &&
		notificationDestinationFingerprint !== null
	) {
		throw new CommunicationApprovalSnapshotError(
			"notificationDestinationFingerprint must be null when notifications are disabled",
		);
	}
	if (
		typeof facts.confirmations?.host !== "boolean" ||
		typeof facts.confirmations?.speakers !== "boolean"
	) {
		throw new CommunicationApprovalSnapshotError(
			"confirmations must contain host and speakers booleans",
		);
	}
	const hostId =
		facts.hostId === null
			? null
			: requireSafeIdentifier(facts.hostId, "hostId");
	if (!Array.isArray(facts.speakerIds)) {
		throw new CommunicationApprovalSnapshotError(
			"speakerIds must be an array of stable identifiers",
		);
	}
	const speakerIds = [
		...new Set(
			facts.speakerIds.map((id) => requireSafeIdentifier(id, "speakerIds")),
		),
	].sort(compareText);
	if (!facts.publicationUrls || typeof facts.publicationUrls !== "object") {
		throw new CommunicationApprovalSnapshotError(
			"publicationUrls must contain public event URL fields",
		);
	}

	const confirmations = Object.freeze({
		host: facts.confirmations.host,
		speakers: facts.confirmations.speakers,
	});
	const publicationUrls = Object.freeze({
		meetup: normalizePublicUrl(facts.publicationUrls.meetup, "meetup"),
		community: normalizePublicUrl(facts.publicationUrls.community, "community"),
		assets: normalizePublicUrl(facts.publicationUrls.assets, "assets"),
	});

	return Object.freeze({
		automationRevision,
		eventId,
		eventDate,
		occurrenceStatus: facts.occurrenceStatus,
		readiness: facts.readiness,
		policyVersion,
		mailingsRepository,
		notificationEnabled: facts.notificationEnabled,
		notificationDestinationFingerprint,
		confirmations,
		hostId,
		speakerIds: Object.freeze(speakerIds),
		publicationUrls,
	});
}

function requireSafeIdentifier(value: string, field: string): string {
	if (typeof value !== "string") {
		throw new CommunicationApprovalSnapshotError(
			`${field} must be a stable, PII-free identifier`,
		);
	}
	const normalized = value.trim();
	if (!isSafeCommunicationIdentifier(normalized)) {
		throw new CommunicationApprovalSnapshotError(
			`${field} must be a stable, PII-free identifier`,
		);
	}
	return normalized;
}

function requireSha256Fingerprint(value: string, field: string): string {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) {
		throw new CommunicationApprovalSnapshotError(
			`${field} must be a SHA-256 fingerprint`,
		);
	}
	return value;
}

function requireIsoDate(value: string): string {
	if (typeof value !== "string") {
		throw new CommunicationApprovalSnapshotError(
			"eventDate must be a real date formatted as YYYY-MM-DD",
		);
	}
	const normalized = value.trim();
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
	if (!match) {
		throw new CommunicationApprovalSnapshotError(
			"eventDate must be a real date formatted as YYYY-MM-DD",
		);
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== month - 1 ||
		parsed.getUTCDate() !== day
	) {
		throw new CommunicationApprovalSnapshotError(
			"eventDate must be a real date formatted as YYYY-MM-DD",
		);
	}
	return normalized;
}

function normalizePublicUrl(
	value: string | null,
	field: keyof CommunicationApprovalPublicationUrls,
): string | null {
	if (value === null) {
		return null;
	}
	if (typeof value !== "string") {
		throw new CommunicationApprovalSnapshotError(
			`${field} publication URL must be an HTTPS URL or null`,
		);
	}
	const normalized = value.trim().replace(/\/$/, "");
	if (!normalized) {
		return null;
	}
	try {
		const url = new URL(normalized);
		if (url.protocol !== "https:" || url.username || url.password) {
			throw new Error("not a public HTTPS URL");
		}
	} catch {
		throw new CommunicationApprovalSnapshotError(
			`${field} publication URL must be an HTTPS URL or null`,
		);
	}
	return normalized;
}

function factsKey(facts: CommunicationApprovalFacts): string {
	return JSON.stringify(facts);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function isOccurrenceStatus(value: unknown): value is EventOccurrenceStatus {
	return (
		typeof value === "string" &&
		["scheduled", "postponed", "held", "cancelled", "unknown"].includes(value)
	);
}

function isReadiness(value: unknown): value is EventReadiness {
	return value === "ready" || value === "not-ready";
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

function isExactRecord(
	value: unknown,
	expectedKeys: readonly string[],
): value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const keys = Object.keys(value).sort(compareText);
	const expected = [...expectedKeys].sort(compareText);
	return (
		keys.length === expected.length &&
		keys.every((key, index) => key === expected[index])
	);
}

function invalidSnapshot(): CommunicationApprovalSnapshotError {
	return new CommunicationApprovalSnapshotError(
		"Communication approval snapshot has an invalid schema",
	);
}
