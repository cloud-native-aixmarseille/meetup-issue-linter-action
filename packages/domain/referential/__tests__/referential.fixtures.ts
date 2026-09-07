import type {
	RawHostRecord,
	RawReferentialCatalog,
	RawSpeakerRecord,
} from "../src/index.js";

export function hostRecord(
	override: Partial<RawHostRecord> = {},
): RawHostRecord {
	return {
		hostId: "host-0001",
		displayName: "Example Host",
		contactId: "contact-0001",
		contactName: "Private Contact",
		email: "contact@example.test",
		phone: "+33 1 23 45 67 89",
		address: "1 Private Street",
		...override,
	};
}

export function speakerRecord(
	override: Partial<RawSpeakerRecord> = {},
): RawSpeakerRecord {
	return {
		speakerId: "speaker-0001",
		firstName: "Example",
		lastName: "Speaker",
		company: "Example Company",
		email: "speaker@example.test",
		phone: "+33 6 12 34 56 78",
		...override,
	};
}

export function rawCatalog(
	override: Partial<RawReferentialCatalog> = {},
): RawReferentialCatalog {
	return {
		hosts: [hostRecord()],
		speakers: [speakerRecord()],
		...override,
	};
}
