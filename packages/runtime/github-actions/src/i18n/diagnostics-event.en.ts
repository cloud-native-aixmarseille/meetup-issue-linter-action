export const DIAGNOSTICS_EVENT_EN = {
	"diagnostic.event.link.feedback.invalid":
		"The feedback link must be a valid HTTPS URL.",
	"diagnostic.event.document.reference-metadata.duplicate":
		"The event document contains duplicate reference metadata",
	"diagnostic.event.document.reference-metadata.invalid":
		"Stable reference metadata is malformed",
	"diagnostic.event.document.reference-metadata.legacy":
		"Unbound stable reference metadata cannot safely restore participant IDs",
	"diagnostic.event.document.reference-metadata.stale":
		"Stable reference metadata does not match visible participants",
	"diagnostic.event.document.reference-metadata.missing":
		"Stable reference metadata is missing",
	"diagnostic.event.document.schema-marker.duplicate":
		"The event document contains duplicate schema markers",
	"diagnostic.event.document.schema-version.unsupported":
		"The event document schema version is unsupported",
	"diagnostic.event.agenda.missing": "At least one agenda entry is required",
	"diagnostic.event.agenda.normalized": "The agenda can be normalized safely",
	"diagnostic.event.agenda.speaker.missing":
		"Each agenda entry must have at least one speaker",
	"diagnostic.event.agenda.speaker.invalid":
		"Speaker display name must not be empty",
	"diagnostic.event.agenda.description.missing":
		"Agenda entry description must not be empty",
	"diagnostic.event.date.missing": "An event date is required",
	"diagnostic.event.date.invalid":
		"Event date must be a real calendar date formatted as YYYY-MM-DD",
	"diagnostic.event.description.missing": "An event description is required",
	"diagnostic.event.hoster.missing": "A host must be selected",
	"diagnostic.event.hoster.invalid": "Host display name must not be empty",
	"diagnostic.event.hoster.normalized":
		"The host reference can be normalized safely",
	"diagnostic.event.links.normalized":
		"Publication links can be normalized safely",
	"diagnostic.event.occurrence-status.label-conflict":
		"Occurrence status labels are mutually exclusive; keep only one of event:postponed, event:held, or event:cancelled",
	"diagnostic.event.occurrence-status.invalid":
		"Occurrence status must be scheduled, postponed, held, or cancelled",
	"diagnostic.event.title.missing": "An event title is required",
	"diagnostic.event.document.invalid-hoster-type":
		"The legacy hoster field must be an array",
	"diagnostic.event.hoster.multiple":
		"A meetup event must have exactly one host",
	"diagnostic.event.document.invalid-hoster-entry":
		"The legacy hoster entry must be a string",
	"diagnostic.event.document.invalid-agenda-type":
		"The legacy agenda field must be a string",
	"diagnostic.event.labels.normalized":
		"Managed meetup labels can be reconciled safely",
	"diagnostic.event.document.legacy-schema":
		"The legacy event document was migrated to schema version 1",
	"diagnostic.event.confirmation.host.missing":
		"Host confirmation is required before the event is ready",
	"diagnostic.event.confirmation.speakers.missing":
		"Speaker confirmation is required before the event is ready",
	"diagnostic.event.agenda.legacy-line-invalid":
		"Use - Speaker: Talk description for each agenda line.",
	"diagnostic.event.link.meetup.invalid":
		"The Meetup publication link must be a valid HTTPS URL.",
	"diagnostic.event.link.community.invalid":
		"The CNCF / OCGroups publication link must be a valid HTTPS URL.",
	"diagnostic.event.link.assets.invalid":
		"The asset folder link must be a valid HTTPS URL.",
	"diagnostic.event.logistics.intent.invalid":
		"Choose Yes or No, or leave the response empty if undecided.",
	"diagnostic.event.document.heading.missing":
		"A required issue section heading is missing.",
	"diagnostic.event.document.heading.duplicate":
		"An issue section heading is duplicated.",
	"diagnostic.event.document.checkbox.invalid":
		"Use - [ ] Task or - [x] Task for checkboxes.",
	"diagnostic.event.document.invalid-field-type":
		"The issue field must contain text.",
	"diagnostic.event.issue-title.normalized":
		"The issue title can be normalized safely.",
} as const;
