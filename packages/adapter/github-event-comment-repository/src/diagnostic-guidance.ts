import type { MessageId } from "./i18n/catalog.js";
export const FIELD_ORDER = [
	"Event Title",
	"Event Date",
	"Hoster",
	"Event Description",
	"Agenda",
	"Meetup Link",
	"CNCF Link",
	"Drive Link",
	"OpenFeedback Link",
	"Slides & Content",
	"Communication",
	"Aperitif",
	"Restaurant / Bar",
	"Post event",
	"Host confirmation",
	"Speaker confirmation",
	"Event Status",
	"Issue format",
	"Referentials",
	"Meetup issue",
];

// Only known, public guidance reaches issue comments; never raw diagnostic values.
export const GUIDANCE = new Map<
	string,
	readonly [
		field: string,
		message: Extract<MessageId, `comment.guidance.${string}`>,
	]
>([
	[
		"event.title.missing",
		["Event Title", "comment.guidance.event.title.missing"],
	],
	["event.date.missing", ["Event Date", "comment.guidance.event.date.missing"]],
	["event.date.invalid", ["Event Date", "comment.guidance.event.date.invalid"]],
	[
		"event.description.missing",
		["Event Description", "comment.guidance.event.description.missing"],
	],
	["event.hoster.missing", ["Hoster", "comment.guidance.event.hoster.missing"]],
	["event.hoster.invalid", ["Hoster", "comment.guidance.event.hoster.invalid"]],
	[
		"event.hoster.multiple",
		["Hoster", "comment.guidance.event.hoster.multiple"],
	],
	["event.agenda.missing", ["Agenda", "comment.guidance.event.agenda.missing"]],
	[
		"event.agenda.legacy-line-invalid",
		["Agenda", "comment.guidance.event.agenda.legacy-line-invalid"],
	],
	[
		"event.agenda.speaker.missing",
		["Agenda", "comment.guidance.event.agenda.speaker.missing"],
	],
	[
		"event.agenda.speaker.invalid",
		["Agenda", "comment.guidance.event.agenda.speaker.invalid"],
	],
	[
		"event.agenda.description.missing",
		["Agenda", "comment.guidance.event.agenda.description.missing"],
	],
	[
		"publication.meetup.missing",
		["Meetup Link", "comment.guidance.publication.meetup.missing"],
	],
	[
		"publication.community.missing",
		["CNCF Link", "comment.guidance.publication.community.missing"],
	],
	[
		"publication.assets.missing",
		["Drive Link", "comment.guidance.publication.assets.missing"],
	],
	[
		"event.link.meetup.invalid",
		["Meetup Link", "comment.guidance.event.link.meetup.invalid"],
	],
	[
		"event.link.community.invalid",
		["CNCF Link", "comment.guidance.event.link.community.invalid"],
	],
	[
		"event.link.feedback.invalid",
		["OpenFeedback Link", "comment.guidance.event.link.feedback.invalid"],
	],
	[
		"event.link.assets.invalid",
		["Drive Link", "comment.guidance.event.link.assets.invalid"],
	],
	[
		"publication.meetup-url.invalid",
		["Meetup Link", "comment.guidance.publication.meetup-url.invalid"],
	],
	[
		"publication.community-url.invalid",
		["CNCF Link", "comment.guidance.publication.community-url.invalid"],
	],
	[
		"publication.asset-url.invalid",
		["Drive Link", "comment.guidance.publication.asset-url.invalid"],
	],
	[
		"event.confirmation.host.missing",
		["Host confirmation", "comment.guidance.event.confirmation.host.missing"],
	],
	[
		"event.confirmation.speakers.missing",
		[
			"Speaker confirmation",
			"comment.guidance.event.confirmation.speakers.missing",
		],
	],
	[
		"event.logistics.intent.invalid",
		["Logistics", "comment.guidance.event.logistics.intent.invalid"],
	],
	[
		"event.occurrence-status.invalid",
		["Event Status", "comment.guidance.event.occurrence-status.invalid"],
	],
	[
		"event.occurrence-status.label-conflict",
		["Event Status", "comment.guidance.event.occurrence-status.label-conflict"],
	],
	[
		"event.document.heading.missing",
		["Issue format", "comment.guidance.event.document.heading.missing"],
	],
	[
		"event.document.heading.duplicate",
		["Issue format", "comment.guidance.event.document.heading.duplicate"],
	],
	[
		"event.document.checkbox.invalid",
		["Issue format", "comment.guidance.event.document.checkbox.invalid"],
	],
	[
		"event.document.invalid-field-type",
		["Issue format", "comment.guidance.event.document.invalid-field-type"],
	],
	[
		"event.document.invalid-hoster-type",
		["Hoster", "comment.guidance.event.document.invalid-hoster-type"],
	],
	[
		"event.document.invalid-hoster-entry",
		["Hoster", "comment.guidance.event.document.invalid-hoster-entry"],
	],
	[
		"event.document.invalid-agenda-type",
		["Agenda", "comment.guidance.event.document.invalid-agenda-type"],
	],
	[
		"event.document.schema-marker.duplicate",
		["Issue format", "comment.guidance.event.document.schema-marker.duplicate"],
	],
	[
		"event.document.schema-version.unsupported",
		[
			"Issue format",
			"comment.guidance.event.document.schema-version.unsupported",
		],
	],
	[
		"event.document.reference-metadata.missing",
		[
			"Issue format",
			"comment.guidance.event.document.reference-metadata.missing",
		],
	],
	[
		"event.document.reference-metadata.duplicate",
		[
			"Issue format",
			"comment.guidance.event.document.reference-metadata.duplicate",
		],
	],
	[
		"event.document.reference-metadata.invalid",
		[
			"Issue format",
			"comment.guidance.event.document.reference-metadata.invalid",
		],
	],
	[
		"event.document.reference-metadata.legacy",
		[
			"Issue format",
			"comment.guidance.event.document.reference-metadata.legacy",
		],
	],
	[
		"event.document.reference-metadata.stale",
		[
			"Issue format",
			"comment.guidance.event.document.reference-metadata.stale",
		],
	],
	[
		"referential.reference.host.unknown",
		["Hoster", "comment.guidance.referential.reference.host.unknown"],
	],
	[
		"referential.reference.host.ambiguous",
		["Hoster", "comment.guidance.referential.reference.host.ambiguous"],
	],
	[
		"referential.reference.host.display-name-mismatch",
		[
			"Hoster",
			"comment.guidance.referential.reference.host.display-name-mismatch",
		],
	],
	[
		"referential.reference.host.invalid",
		["Hoster", "comment.guidance.referential.reference.host.invalid"],
	],
	[
		"referential.reference.speaker.unknown",
		["Agenda", "comment.guidance.referential.reference.speaker.unknown"],
	],
	[
		"referential.reference.speaker.ambiguous",
		["Agenda", "comment.guidance.referential.reference.speaker.ambiguous"],
	],
	[
		"referential.reference.speaker.display-name-mismatch",
		[
			"Agenda",
			"comment.guidance.referential.reference.speaker.display-name-mismatch",
		],
	],
	[
		"referential.reference.speaker.invalid",
		["Agenda", "comment.guidance.referential.reference.speaker.invalid"],
	],
]);
