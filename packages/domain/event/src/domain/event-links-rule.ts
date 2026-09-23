import { type EventDiagnostic, EventDiagnostics } from "./diagnostic.js";
import { EventRuleFactory } from "./event-rule-factory.js";
import type { MeetupEvent } from "./model.js";
import { EMPTY_EVENT_PATCH, EventPatches } from "./patch.js";
import type { EventRule, EventRuleResult } from "./rule-contracts.js";

/** Generic URL safety belongs here; provider-specific URL policy is Publication. */
export class EventLinksRule implements EventRule {
	readonly id = "event-links";
	readonly dependencies: readonly string[] = [];

	evaluate(event: MeetupEvent): EventRuleResult {
		const diagnostics: EventDiagnostic[] = [];
		const normalized: {
			meetup?: string;
			community?: string;
			assets?: string;
			feedback?: string;
		} = { ...event.publicationLinks };
		let changed = false;

		for (const key of ["meetup", "community", "assets", "feedback"] as const) {
			const link = event.publicationLinks[key];
			if (link === undefined || link.trim() === "") {
				continue;
			}

			const value = link.trim().replace(/\/$/, "");
			if (!EventRuleFactory.isHttpsUrl(value)) {
				diagnostics.push(
					EventDiagnostics.diagnostic({
						code: `event.link.${key}.invalid`,
						severity: "error",
						category: "invalid",
						field: `publicationLinks.${key}`,
						message: `${key} link must be a valid HTTPS URL`,
					}),
				);
				continue;
			}
			if (value !== link) {
				normalized[key] = value;
				changed = true;
			}
		}

		if (!changed) {
			return { diagnostics, patch: EMPTY_EVENT_PATCH };
		}

		diagnostics.push(
			EventDiagnostics.diagnostic({
				code: "event.links.normalized",
				severity: "info",
				category: "normalization",
				field: "publicationLinks",
				message: "Publication links can be normalized safely",
				fixAvailable: true,
			}),
		);

		return {
			diagnostics,
			patch: EventPatches.createEventPatch([
				EventPatches.replaceEventField(
					"publicationLinks",
					normalized,
					"Trim publication links and remove trailing slashes",
				),
			]),
		};
	}
}
