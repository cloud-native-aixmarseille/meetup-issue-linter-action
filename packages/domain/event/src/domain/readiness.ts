import { diagnostic, type EventDiagnostic } from "./diagnostic.js";
import type { MeetupEvent } from "./model.js";

export type EventReadinessStatus = "invalid" | "incomplete" | "ready";

export type EventReadiness = Readonly<{
	status: EventReadinessStatus;
	isReady: boolean;
	diagnostics: readonly EventDiagnostic[];
}>;

export function evaluateEventReadiness(
	event: MeetupEvent,
	diagnostics: readonly EventDiagnostic[],
): EventReadiness {
	const readinessDiagnostics = [...diagnostics];

	if (event.occurrenceStatus === "cancelled") {
		return {
			status: "incomplete",
			isReady: false,
			diagnostics: readinessDiagnostics,
		};
	}

	if (event.occurrenceStatus === "postponed") {
		return {
			status: "incomplete",
			isReady: false,
			diagnostics: readinessDiagnostics,
		};
	}

	if (readinessDiagnostics.some((item) => item.severity === "error")) {
		return {
			status: "invalid",
			isReady: false,
			diagnostics: readinessDiagnostics,
		};
	}

	if (!event.confirmations.host) {
		readinessDiagnostics.push(
			diagnostic({
				code: "event.confirmation.host.missing",
				severity: "warning",
				category: "incomplete",
				field: "confirmations.host",
				message: "Host confirmation is required before the event is ready",
			}),
		);
	}
	if (!event.confirmations.speakers) {
		readinessDiagnostics.push(
			diagnostic({
				code: "event.confirmation.speakers.missing",
				severity: "warning",
				category: "incomplete",
				field: "confirmations.speakers",
				message: "Speaker confirmation is required before the event is ready",
			}),
		);
	}

	const incomplete = readinessDiagnostics.some(
		(item) => item.category === "incomplete",
	);
	return {
		status: incomplete ? "incomplete" : "ready",
		isReady: !incomplete,
		diagnostics: Object.freeze(readinessDiagnostics),
	};
}
