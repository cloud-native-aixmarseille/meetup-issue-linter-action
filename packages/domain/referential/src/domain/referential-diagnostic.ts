export type ReferentialDiagnosticSeverity = "error" | "warning";

export type ReferentialDiagnosticCode =
	| "referential.host.id.invalid"
	| "referential.host.id.conflict"
	| "referential.host.display-name.invalid"
	| "referential.host.display-name.duplicate"
	| "referential.contact.id.invalid"
	| "referential.contact.id.duplicate"
	| "referential.contact.name.invalid"
	| "referential.contact.email.invalid"
	| "referential.contact.phone.invalid"
	| "referential.contact.address.invalid"
	| "referential.speaker.id.invalid"
	| "referential.speaker.id.duplicate"
	| "referential.speaker.first-name.invalid"
	| "referential.speaker.last-name.invalid"
	| "referential.speaker.company.invalid"
	| "referential.speaker.email.invalid"
	| "referential.speaker.phone.invalid"
	| "referential.speaker.display-name.duplicate"
	| "referential.reference.host.invalid"
	| "referential.reference.host.unknown"
	| "referential.reference.host.ambiguous"
	| "referential.reference.host.display-name-mismatch"
	| "referential.reference.speaker.invalid"
	| "referential.reference.speaker.unknown"
	| "referential.reference.speaker.ambiguous"
	| "referential.reference.speaker.display-name-mismatch";

export interface ReferentialDiagnostic {
	readonly code: ReferentialDiagnosticCode;
	readonly severity: ReferentialDiagnosticSeverity;
	readonly path: string;
	readonly message: string;
}

export function diagnostic(
	code: ReferentialDiagnosticCode,
	severity: ReferentialDiagnosticSeverity,
	path: string,
	message: string,
): ReferentialDiagnostic {
	return Object.freeze({ code, severity, path, message });
}

export function freezeDiagnostics(
	diagnostics: readonly ReferentialDiagnostic[],
): readonly ReferentialDiagnostic[] {
	return Object.freeze([...diagnostics]);
}
