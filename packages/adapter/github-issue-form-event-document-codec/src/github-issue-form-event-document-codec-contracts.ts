export const CURRENT_SCHEMA_MARKER = "<!-- meetup-event-schema:1 -->";

export const SCHEMA_MARKER_NAME = "meetup-event-schema";

export const REFERENCE_MARKER_NAME = "meetup-event-references";

export const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

export const HEADINGS = Object.freeze({
	eventTitle: "Event Title",
	date: "Event Date",
	host: "Hoster",
	description: "Event Description",
	agenda: "Agenda",
	meetupLink: "Meetup Link",
	communityLink: "CNCF Link",
	assetsLink: "Drive Link",
	feedbackLink: "OpenFeedback Link",
	slides: "Slides & Content",
	communication: "Communication",
	aperitif: "Aperitif",
	restaurant: "Restaurant / Bar",
	postEvent: "Post event",
	occurrenceStatus: "Event Status",
});

export interface GitHubIssueFormEventDocumentCodecOptions {
	/** Consumer checkout revision used for catalog navigation links. */
	readonly repositoryRef?: string;
	readonly timeZone?: string;
	readonly hostConfirmationLabel?: string;
	readonly speakersConfirmationLabel?: string;
}

export type LegacyReferenceMetadata = Readonly<{
	hostId: string | null;
	agendaSpeakerIds: readonly (readonly (string | null)[])[];
}>;

export type StableReferenceBinding = Readonly<{
	id: string;
	displayName: string;
}>;

export type StableReferenceMetadata = Readonly<{
	schemaVersion: 2;
	host: StableReferenceBinding | null;
	speakers: readonly StableReferenceBinding[];
}>;

export type ParsedReferenceMetadata =
	| Readonly<{ kind: "bound"; value: StableReferenceMetadata }>
	| Readonly<{ kind: "legacy"; value: LegacyReferenceMetadata }>;

export type Section = Readonly<{
	heading: string;
	headingStart: number;
	contentStart: number;
	contentEnd: number;
	value: string;
}>;

export type Checkbox = Readonly<{
	checked: boolean;
	label: string;
}>;

export type ManagedMarkerMatch = Readonly<{
	start: number;
	end: number;
	value: string;
}>;
