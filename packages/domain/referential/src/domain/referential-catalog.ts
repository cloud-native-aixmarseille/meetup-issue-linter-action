import type { ContactId, HostId, SpeakerId } from "./identifiers.js";

export interface HostContact {
	readonly id: ContactId;
	readonly name: string;
	readonly email: string;
	readonly phone?: string;
	readonly address: string;
}

export interface Host {
	readonly id: HostId;
	readonly displayName: string;
	readonly contacts: readonly HostContact[];
}

export interface Speaker {
	readonly id: SpeakerId;
	readonly displayName: string;
	readonly firstName: string;
	readonly lastName: string;
	readonly company: string;
	readonly email: string;
	readonly phone?: string;
}

export interface ReferentialCatalog {
	readonly hosts: readonly Host[];
	readonly speakers: readonly Speaker[];
}

export interface RawHostRecord {
	readonly hostId: unknown;
	readonly displayName: unknown;
	readonly contactId: unknown;
	readonly contactName: unknown;
	readonly email: unknown;
	readonly phone?: unknown;
	readonly address: unknown;
}

export interface RawSpeakerRecord {
	readonly speakerId: unknown;
	readonly firstName: unknown;
	readonly lastName: unknown;
	readonly company: unknown;
	readonly email: unknown;
	readonly phone?: unknown;
}

export interface RawReferentialCatalog {
	readonly hosts: readonly RawHostRecord[];
	readonly speakers: readonly RawSpeakerRecord[];
}

export function normalizeDisplayName(value: string): string {
	return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function displayNameKey(value: string): string {
	return normalizeDisplayName(value).toLowerCase();
}

export function freezeCatalog(
	hosts: readonly Host[],
	speakers: readonly Speaker[],
): ReferentialCatalog {
	for (const host of hosts) {
		for (const contact of host.contacts) {
			Object.freeze(contact);
		}
		Object.freeze(host.contacts);
		Object.freeze(host);
	}

	for (const speaker of speakers) {
		Object.freeze(speaker);
	}

	return Object.freeze({
		hosts: Object.freeze([...hosts]),
		speakers: Object.freeze([...speakers]),
	});
}
