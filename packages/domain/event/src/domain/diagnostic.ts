export type DiagnosticSeverity = "info" | "warning" | "error";

export type DiagnosticCategory =
	| "incomplete"
	| "invalid"
	| "migration"
	| "normalization";

export type EventDiagnostic = Readonly<{
	code: string;
	severity: DiagnosticSeverity;
	category: DiagnosticCategory;
	message: string;
	field?: string;
	fixAvailable?: boolean;
}>;

export function diagnostic(value: EventDiagnostic): Readonly<EventDiagnostic> {
	return Object.freeze({ ...value });
}

export function missingOccurrenceStatusDiagnostic(): EventDiagnostic {
	return diagnostic({
		code: "event.occurrence-status.missing",
		severity: "warning",
		category: "migration",
		field: "occurrenceStatus",
		message:
			"Occurrence status must be backfilled before occurrence-dependent effects are enabled",
	});
}
