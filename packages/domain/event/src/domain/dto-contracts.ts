import type { EventDiagnostic } from "./diagnostic.js";
import type { MeetupEvent, OccurrenceStatus } from "./model.js";

export type LegacyMeetupIssueBodyDto = Readonly<{
	event_date?: unknown;
	event_title?: unknown;
	hoster?: unknown;
	event_description?: unknown;
	agenda?: unknown;
	meetup_link?: unknown;
	cncf_link?: unknown;
	drive_link?: unknown;
	openfeedback_link?: unknown;
	event_status?: unknown;
}>;

/** The schema consumed by the historical legacy issue workflow. */
export type LegacyMeetupEventDto = Readonly<{
	schemaVersion?: 0;
	repository: string;
	issueNumber: number;
	issueState?: "open" | "closed";
	issueTitle: string;
	labels?: readonly string[];
	parsedBody: LegacyMeetupIssueBodyDto;
	timeZone?: string;
	/** @deprecated A boolean without named task evidence is never trusted. */
	followUpComplete?: boolean;
}>;

/** The current, technology-independent event document DTO. */
export type MeetupEventDtoV1 = MeetupEvent;

export type MeetupEventDto = LegacyMeetupEventDto | MeetupEventDtoV1;

export type EventDtoMigrationResult = Readonly<{
	event: MeetupEvent;
	diagnostics: readonly EventDiagnostic[];
}>;

export const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

export const OCCURRENCE_STATUSES: readonly OccurrenceStatus[] = [
	"scheduled",
	"postponed",
	"held",
	"cancelled",
];

export const OCCURRENCE_STATUS_LABELS: Readonly<
	Record<OccurrenceStatus, string | null>
> = Object.freeze({
	scheduled: null,
	postponed: "event:postponed",
	held: "event:held",
	cancelled: "event:cancelled",
});
