import type { EventDiagnostic } from "@meetup-automation/event";
import { FIELD_ORDER, GUIDANCE } from "./diagnostic-guidance.js";
import { EventCommentMessages } from "./i18n/event-comment-messages.js";

export type DiagnosticPresentation = Readonly<{
	field: string;
	message: string;
	order: number;
}>;

export class DiagnosticPresenter {
	private static readonly FIELD_ALIASES = new Map([
		...FIELD_ORDER.map((field): [string, string] => [field, field]),
		["eventTitle", "Event Title"],
		["event_title", "Event Title"],
		["date", "Event Date"],
		["event_date", "Event Date"],
		["host", "Hoster"],
		["hoster", "Hoster"],
		["hostReference", "Hoster"],
		["description", "Event Description"],
		["event_description", "Event Description"],
		["agenda", "Agenda"],
		["publicationLinks.meetup", "Meetup Link"],
		["meetup_link", "Meetup Link"],
		["publicationLinks.community", "CNCF Link"],
		["cncf_link", "CNCF Link"],
		["publicationLinks.assets", "Drive Link"],
		["drive_link", "Drive Link"],
		["publicationLinks.feedback", "OpenFeedback Link"],
		["openfeedback_link", "OpenFeedback Link"],
		["confirmations.host", "Host confirmation"],
		["confirmations.speakers", "Speaker confirmation"],
		["occurrenceStatus", "Event Status"],
		["event_status", "Event Status"],
	]);

	static presentDiagnostic(
		item: EventDiagnostic,
		messages = new EventCommentMessages(),
	): DiagnosticPresentation {
		const guidance = GUIDANCE.get(item.code);
		const referential = /^referential\.(host|contact|speaker)\./.test(
			item.code,
		);
		const fallback =
			guidance?.[0] ?? (referential ? "Referentials" : "Meetup issue");
		const [field, section] = DiagnosticPresenter.publicField(
			item.field,
			fallback,
			messages,
		);
		const message = guidance
			? messages.t(guidance[1])
			: messages.t(referential ? "comment.referential" : "comment.unknown");
		const order = FIELD_ORDER.indexOf(section);
		return { field, message, order: order < 0 ? FIELD_ORDER.length : order };
	}

	/** Only known issue headings and numeric agenda positions can reach Markdown. */
	static publicField(
		field: string | undefined,
		fallback: string,
		messages = new EventCommentMessages(),
	): readonly [string, string] {
		const known = DiagnosticPresenter.FIELD_ALIASES.get(field ?? "");
		if (known) return [known, known];
		const agenda = field?.match(
			/^agenda\.(\d{1,6})(?:\.(speakers|description)(?:\.(\d{1,6}))?)?$/,
		);
		if (agenda) {
			const entry = Number(agenda[1]) + 1;
			const speaker =
				agenda[3] === undefined
					? ""
					: messages.t("comment.agenda.speaker-suffix", {
							speaker: Number(agenda[3]) + 1,
						});
			return [
				messages.t("comment.agenda.item", { item: entry, speaker }),
				"Agenda",
			];
		}
		const speaker = field?.match(/^speakerReferences\[(\d{1,6})\]$/);
		if (speaker)
			return [
				messages.t("comment.agenda.speaker", {
					speaker: Number(speaker[1]) + 1,
				}),
				"Agenda",
			];
		return [fallback, fallback];
	}
}
