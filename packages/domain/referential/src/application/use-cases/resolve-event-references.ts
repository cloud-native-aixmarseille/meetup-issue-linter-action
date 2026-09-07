import { asHostId, asSpeakerId } from "../../domain/identifiers.js";
import {
	displayNameKey,
	type Host,
	normalizeDisplayName,
	type ReferentialCatalog,
	type Speaker,
} from "../../domain/referential-catalog.js";
import {
	diagnostic,
	freezeDiagnostics,
	type ReferentialDiagnostic,
} from "../../domain/referential-diagnostic.js";

export interface ResolveEventReferencesCommand {
	readonly hostReference: string;
	readonly speakerReferences: readonly string[];
}

export type ResolveEventReferencesResult =
	| Readonly<{
			resolved: true;
			host: Host;
			speakers: readonly Speaker[];
			diagnostics: readonly ReferentialDiagnostic[];
	  }>
	| Readonly<{
			resolved: false;
			diagnostics: readonly ReferentialDiagnostic[];
	  }>;

interface ParsedReference {
	readonly displayName: string;
	readonly stableId?: string;
}

const EXPLICIT_REFERENCE_PATTERN = /^(.*?)\s+\[([^\]]+)]\s*$/;

export class ResolveEventReferences {
	execute(
		catalog: ReferentialCatalog,
		command: ResolveEventReferencesCommand,
	): ResolveEventReferencesResult {
		const diagnostics: ReferentialDiagnostic[] = [];
		const host = this.resolveHost(
			catalog.hosts,
			command.hostReference,
			diagnostics,
		);
		const speakers = command.speakerReferences
			.map((reference, index) =>
				this.resolveSpeaker(catalog.speakers, reference, index, diagnostics),
			)
			.filter((speaker): speaker is Speaker => speaker !== undefined);

		const frozenDiagnostics = freezeDiagnostics(diagnostics);
		if (!host || diagnostics.some(({ severity }) => severity === "error")) {
			return Object.freeze({
				resolved: false as const,
				diagnostics: frozenDiagnostics,
			});
		}

		const uniqueSpeakers = [
			...new Map(speakers.map((speaker) => [speaker.id, speaker])).values(),
		];
		return Object.freeze({
			resolved: true as const,
			host,
			speakers: Object.freeze(uniqueSpeakers),
			diagnostics: frozenDiagnostics,
		});
	}

	private resolveHost(
		hosts: readonly Host[],
		reference: string,
		diagnostics: ReferentialDiagnostic[],
	): Host | undefined {
		const parsed = this.parseReference(reference);
		if (!parsed) {
			diagnostics.push(
				diagnostic(
					"referential.reference.host.invalid",
					"error",
					"hostReference",
					"Host reference must be a display name or use Display name [host-0001] syntax.",
				),
			);
			return undefined;
		}

		if (parsed.stableId !== undefined) {
			const id = asHostId(parsed.stableId);
			if (!id) {
				diagnostics.push(
					diagnostic(
						"referential.reference.host.invalid",
						"error",
						"hostReference",
						"Explicit host reference contains an invalid stable identifier.",
					),
				);
				return undefined;
			}

			const host = hosts.find((candidate) => candidate.id === id);
			if (!host) {
				diagnostics.push(
					diagnostic(
						"referential.reference.host.unknown",
						"error",
						"hostReference",
						"Explicit host stable identifier is not present in the catalog.",
					),
				);
				return undefined;
			}

			if (
				displayNameKey(host.displayName) !== displayNameKey(parsed.displayName)
			) {
				diagnostics.push(
					diagnostic(
						"referential.reference.host.display-name-mismatch",
						"warning",
						"hostReference",
						"Host display name is stale; the stable identifier remains authoritative.",
					),
				);
			}
			return host;
		}

		const matches = hosts.filter(
			(host) =>
				displayNameKey(host.displayName) === displayNameKey(parsed.displayName),
		);
		if (matches.length === 1) {
			return matches[0];
		}

		diagnostics.push(
			diagnostic(
				matches.length === 0
					? "referential.reference.host.unknown"
					: "referential.reference.host.ambiguous",
				"error",
				"hostReference",
				matches.length === 0
					? "Legacy host display name is not present in the catalog."
					: "Legacy host display name is ambiguous; include the stable identifier.",
			),
		);
		return undefined;
	}

	private resolveSpeaker(
		speakers: readonly Speaker[],
		reference: string,
		index: number,
		diagnostics: ReferentialDiagnostic[],
	): Speaker | undefined {
		const path = `speakerReferences[${index}]`;
		const parsed = this.parseReference(reference);
		if (!parsed) {
			diagnostics.push(
				diagnostic(
					"referential.reference.speaker.invalid",
					"error",
					path,
					"Speaker reference must be a display name or use Display name [speaker-0001] syntax.",
				),
			);
			return undefined;
		}

		if (parsed.stableId !== undefined) {
			const id = asSpeakerId(parsed.stableId);
			if (!id) {
				diagnostics.push(
					diagnostic(
						"referential.reference.speaker.invalid",
						"error",
						path,
						"Explicit speaker reference contains an invalid stable identifier.",
					),
				);
				return undefined;
			}

			const speaker = speakers.find((candidate) => candidate.id === id);
			if (!speaker) {
				diagnostics.push(
					diagnostic(
						"referential.reference.speaker.unknown",
						"error",
						path,
						"Explicit speaker stable identifier is not present in the catalog.",
					),
				);
				return undefined;
			}

			if (
				displayNameKey(speaker.displayName) !==
				displayNameKey(parsed.displayName)
			) {
				diagnostics.push(
					diagnostic(
						"referential.reference.speaker.display-name-mismatch",
						"warning",
						path,
						"Speaker display name is stale; the stable identifier remains authoritative.",
					),
				);
			}
			return speaker;
		}

		const matches = speakers.filter(
			(speaker) =>
				displayNameKey(speaker.displayName) ===
				displayNameKey(parsed.displayName),
		);
		if (matches.length === 1) {
			return matches[0];
		}

		diagnostics.push(
			diagnostic(
				matches.length === 0
					? "referential.reference.speaker.unknown"
					: "referential.reference.speaker.ambiguous",
				"error",
				path,
				matches.length === 0
					? "Legacy speaker display name is not present in the catalog."
					: "Legacy speaker display name is ambiguous; include the stable identifier.",
			),
		);
		return undefined;
	}

	private parseReference(reference: string): ParsedReference | undefined {
		if (typeof reference !== "string") {
			return undefined;
		}

		const normalized = normalizeDisplayName(reference);
		if (!normalized) {
			return undefined;
		}

		const explicit = normalized.match(EXPLICIT_REFERENCE_PATTERN);
		if (!explicit) {
			return { displayName: normalized };
		}

		const displayName = normalizeDisplayName(explicit[1]);
		const stableId = explicit[2].trim();
		if (!displayName || !stableId) {
			return undefined;
		}

		return { displayName, stableId };
	}
}
