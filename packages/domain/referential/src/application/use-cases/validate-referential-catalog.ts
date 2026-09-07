import {
	asContactId,
	asHostId,
	asSpeakerId,
	type HostId,
} from "../../domain/identifiers.js";
import {
	displayNameKey,
	freezeCatalog,
	type Host,
	type HostContact,
	normalizeDisplayName,
	type RawHostRecord,
	type RawReferentialCatalog,
	type RawSpeakerRecord,
	type ReferentialCatalog,
	type Speaker,
} from "../../domain/referential-catalog.js";
import {
	diagnostic,
	freezeDiagnostics,
	type ReferentialDiagnostic,
} from "../../domain/referential-diagnostic.js";
import type { ReferentialRepository } from "../ports/referential-repository.js";

export type ReferentialCatalogValidation =
	| Readonly<{
			isValid: true;
			catalog: ReferentialCatalog;
			diagnostics: readonly ReferentialDiagnostic[];
	  }>
	| Readonly<{
			isValid: false;
			diagnostics: readonly ReferentialDiagnostic[];
	  }>;

interface HostBuilder {
	readonly id: HostId;
	readonly displayName: string;
	readonly contacts: HostContact[];
}

interface ParsedHostRecord {
	readonly hostId: NonNullable<ReturnType<typeof asHostId>>;
	readonly displayName: string;
	readonly contact: HostContact;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidateReferentialCatalog {
	constructor(private readonly repository?: ReferentialRepository) {}

	async execute(
		rawCatalog?: RawReferentialCatalog,
	): Promise<ReferentialCatalogValidation> {
		const input = rawCatalog ?? (await this.loadCatalog());
		const diagnostics: ReferentialDiagnostic[] = [];
		const hosts = this.validateHosts(input.hosts, diagnostics);
		const speakers = this.validateSpeakers(input.speakers, diagnostics);

		this.reportDuplicateDisplayNames(
			hosts,
			"referential.host.display-name.duplicate",
			"hosts",
			"Duplicate normalized host display names are not allowed; keep one stable host per public name.",
			diagnostics,
		);
		this.reportDuplicateDisplayNames(
			speakers,
			"referential.speaker.display-name.duplicate",
			"speakers",
			"Duplicate normalized speaker display names are not allowed; keep one stable speaker per public name.",
			diagnostics,
		);

		const frozenDiagnostics = freezeDiagnostics(diagnostics);
		if (diagnostics.some(({ severity }) => severity === "error")) {
			return Object.freeze({
				isValid: false as const,
				diagnostics: frozenDiagnostics,
			});
		}

		return Object.freeze({
			isValid: true as const,
			catalog: freezeCatalog(hosts, speakers),
			diagnostics: frozenDiagnostics,
		});
	}

	private async loadCatalog(): Promise<RawReferentialCatalog> {
		if (!this.repository) {
			throw new Error(
				"A referential repository or an explicit raw catalog is required.",
			);
		}

		return this.repository.load();
	}

	private validateHosts(
		records: readonly RawHostRecord[],
		diagnostics: ReferentialDiagnostic[],
	): Host[] {
		const hostsById = new Map<HostId, HostBuilder>();
		const contactIds = new Set<string>();

		for (const [index, record] of records.entries()) {
			const parsed = this.parseHostRecord(record, index, diagnostics);
			if (!parsed) {
				continue;
			}

			if (contactIds.has(parsed.contact.id)) {
				diagnostics.push(
					diagnostic(
						"referential.contact.id.duplicate",
						"error",
						`hosts[${index}].contactId`,
						"Contact stable identifiers must be unique.",
					),
				);
				continue;
			}
			contactIds.add(parsed.contact.id);

			const host = hostsById.get(parsed.hostId);
			if (!host) {
				hostsById.set(parsed.hostId, {
					id: parsed.hostId,
					displayName: parsed.displayName,
					contacts: [parsed.contact],
				});
				continue;
			}

			if (host.displayName !== parsed.displayName) {
				diagnostics.push(
					diagnostic(
						"referential.host.id.conflict",
						"error",
						`hosts[${index}].hostId`,
						"A host stable identifier cannot describe different host names.",
					),
				);
				continue;
			}

			host.contacts.push(parsed.contact);
		}

		return [...hostsById.values()].map((host) => ({
			id: host.id,
			displayName: host.displayName,
			contacts: host.contacts,
		}));
	}

	private parseHostRecord(
		record: RawHostRecord,
		index: number,
		diagnostics: ReferentialDiagnostic[],
	): ParsedHostRecord | undefined {
		const hostIdValue = this.requiredText(
			record.hostId,
			"referential.host.id.invalid",
			`hosts[${index}].hostId`,
			"Host stable identifier must be a non-empty string.",
			diagnostics,
		);
		const hostId = hostIdValue ? asHostId(hostIdValue) : undefined;
		if (hostIdValue && !hostId) {
			diagnostics.push(
				diagnostic(
					"referential.host.id.invalid",
					"error",
					`hosts[${index}].hostId`,
					"Host stable identifier must use the opaque host-0001 format.",
				),
			);
		}

		const displayName = this.requiredText(
			record.displayName,
			"referential.host.display-name.invalid",
			`hosts[${index}].displayName`,
			"Host display name must be a non-empty string.",
			diagnostics,
		);
		const contactIdValue = this.requiredText(
			record.contactId,
			"referential.contact.id.invalid",
			`hosts[${index}].contactId`,
			"Contact stable identifier must be a non-empty string.",
			diagnostics,
		);
		const contactId = contactIdValue ? asContactId(contactIdValue) : undefined;
		if (contactIdValue && !contactId) {
			diagnostics.push(
				diagnostic(
					"referential.contact.id.invalid",
					"error",
					`hosts[${index}].contactId`,
					"Contact stable identifier must use the opaque contact-0001 format.",
				),
			);
		}

		const contactName = this.requiredText(
			record.contactName,
			"referential.contact.name.invalid",
			`hosts[${index}].contactName`,
			"Contact name must be a non-empty string.",
			diagnostics,
		);
		const email = this.email(
			record.email,
			"referential.contact.email.invalid",
			`hosts[${index}].email`,
			"Host contact email address is invalid.",
			diagnostics,
		);
		const phone = this.optionalText(
			record.phone,
			"referential.contact.phone.invalid",
			`hosts[${index}].phone`,
			"Host contact phone must be a string when provided.",
			diagnostics,
		);
		const address = this.requiredText(
			record.address,
			"referential.contact.address.invalid",
			`hosts[${index}].address`,
			"Host contact address must be a non-empty string.",
			diagnostics,
		);

		if (
			!hostId ||
			!displayName ||
			!contactId ||
			!contactName ||
			!email ||
			address === undefined ||
			phone === null
		) {
			return undefined;
		}

		return {
			hostId,
			displayName,
			contact: {
				id: contactId,
				name: contactName,
				email,
				...(phone ? { phone } : {}),
				address,
			},
		};
	}

	private validateSpeakers(
		records: readonly RawSpeakerRecord[],
		diagnostics: ReferentialDiagnostic[],
	): Speaker[] {
		const speakers: Speaker[] = [];
		const speakerIds = new Set<string>();

		for (const [index, record] of records.entries()) {
			const speakerIdValue = this.requiredText(
				record.speakerId,
				"referential.speaker.id.invalid",
				`speakers[${index}].speakerId`,
				"Speaker stable identifier must be a non-empty string.",
				diagnostics,
			);
			const speakerId = speakerIdValue
				? asSpeakerId(speakerIdValue)
				: undefined;
			if (speakerIdValue && !speakerId) {
				diagnostics.push(
					diagnostic(
						"referential.speaker.id.invalid",
						"error",
						`speakers[${index}].speakerId`,
						"Speaker stable identifier must use the speaker-* slug format.",
					),
				);
			}

			const firstName = this.requiredText(
				record.firstName,
				"referential.speaker.first-name.invalid",
				`speakers[${index}].firstName`,
				"Speaker first name must be a non-empty string.",
				diagnostics,
			);
			const lastName = this.requiredText(
				record.lastName,
				"referential.speaker.last-name.invalid",
				`speakers[${index}].lastName`,
				"Speaker last name must be a non-empty string.",
				diagnostics,
			);
			const company = this.requiredText(
				record.company,
				"referential.speaker.company.invalid",
				`speakers[${index}].company`,
				"Speaker company must be a non-empty string.",
				diagnostics,
			);
			const email = this.email(
				record.email,
				"referential.speaker.email.invalid",
				`speakers[${index}].email`,
				"Speaker email address is invalid.",
				diagnostics,
			);
			const phone = this.optionalText(
				record.phone,
				"referential.speaker.phone.invalid",
				`speakers[${index}].phone`,
				"Speaker phone must be a string when provided.",
				diagnostics,
			);

			if (
				!speakerId ||
				!firstName ||
				!lastName ||
				!company ||
				!email ||
				phone === null
			) {
				continue;
			}

			if (speakerIds.has(speakerId)) {
				diagnostics.push(
					diagnostic(
						"referential.speaker.id.duplicate",
						"error",
						`speakers[${index}].speakerId`,
						"Speaker stable identifiers must be unique.",
					),
				);
				continue;
			}
			speakerIds.add(speakerId);

			speakers.push({
				id: speakerId,
				firstName,
				lastName,
				displayName: `${firstName} ${lastName}`,
				company,
				email,
				...(phone ? { phone } : {}),
			});
		}

		return speakers;
	}

	private requiredText(
		value: unknown,
		code: Parameters<typeof diagnostic>[0],
		path: string,
		message: string,
		diagnostics: ReferentialDiagnostic[],
	): string | undefined {
		if (typeof value !== "string") {
			diagnostics.push(diagnostic(code, "error", path, message));
			return undefined;
		}

		const normalized = normalizeDisplayName(value);
		if (!normalized) {
			diagnostics.push(diagnostic(code, "error", path, message));
			return undefined;
		}

		return normalized;
	}

	private optionalText(
		value: unknown,
		code: Parameters<typeof diagnostic>[0],
		path: string,
		message: string,
		diagnostics: ReferentialDiagnostic[],
	): string | undefined | null {
		if (value === undefined || value === null || value === "") {
			return undefined;
		}
		if (typeof value !== "string") {
			diagnostics.push(diagnostic(code, "error", path, message));
			return null;
		}

		return value.normalize("NFC").trim() || undefined;
	}

	private email(
		value: unknown,
		code: Parameters<typeof diagnostic>[0],
		path: string,
		message: string,
		diagnostics: ReferentialDiagnostic[],
	): string | undefined {
		if (typeof value !== "string") {
			diagnostics.push(diagnostic(code, "error", path, message));
			return undefined;
		}

		const normalized = value.normalize("NFC").trim().toLowerCase();
		if (!EMAIL_PATTERN.test(normalized)) {
			diagnostics.push(diagnostic(code, "error", path, message));
			return undefined;
		}

		return normalized;
	}

	private reportDuplicateDisplayNames(
		entities: readonly Readonly<{ displayName: string }>[],
		code: Parameters<typeof diagnostic>[0],
		path: string,
		message: string,
		diagnostics: ReferentialDiagnostic[],
	): void {
		const counts = new Map<string, number>();
		for (const entity of entities) {
			const key = displayNameKey(entity.displayName);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}

		let ambiguityIndex = 0;
		for (const count of counts.values()) {
			if (count < 2) {
				continue;
			}
			diagnostics.push(
				diagnostic(
					code,
					"error",
					`${path}.ambiguities[${ambiguityIndex}]`,
					message,
				),
			);
			ambiguityIndex += 1;
		}
	}
}
