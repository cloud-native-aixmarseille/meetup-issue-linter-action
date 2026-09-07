import * as core from "@actions/core";
import type { PublicDiagnostic } from "@meetup-automation/journey";

export function setJsonOutput(name: string, value: unknown): void {
	core.setOutput(name, JSON.stringify(value));
}

export function setDiagnosticsOutput(
	diagnostics: readonly PublicDiagnostic[],
): void {
	setJsonOutput("diagnostics", diagnostics);
}
