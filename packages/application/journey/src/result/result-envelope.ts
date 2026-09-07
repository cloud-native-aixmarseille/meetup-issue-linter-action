export type ResultStatus = "ok" | "diagnostics";

export interface PublicDiagnostic {
	code: string;
	severity: "error" | "warning" | "info";
	message: string;
	field?: string;
	fixApplied?: boolean;
}

export interface ResultEnvelope<T extends object = Record<string, never>> {
	schemaVersion: 1;
	status: ResultStatus;
	diagnostics: readonly PublicDiagnostic[];
	data: T;
}

export function resultEnvelope<T extends object>(
	data: T,
	diagnostics: readonly PublicDiagnostic[],
): ResultEnvelope<T> {
	return {
		schemaVersion: 1,
		status: diagnostics.length === 0 ? "ok" : "diagnostics",
		diagnostics,
		data,
	};
}
