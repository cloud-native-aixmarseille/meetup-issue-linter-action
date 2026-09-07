export const EVENT_SCHEMA_VERSION = 1 as const;

export type EventIdentity = Readonly<{
	repository: string;
	issueNumber: number;
}>;

export type IssueState = "open" | "closed";

export type OccurrenceStatus = "scheduled" | "postponed" | "held" | "cancelled";

export type EventLifecycleState =
	| "draft"
	| "planned"
	| "ready"
	| "postponed"
	| "cancelled"
	| "held"
	| "follow-up-complete";

export type ParticipantReference = Readonly<{
	id?: string;
	displayName: string;
}>;

export type AgendaEntry = Readonly<{
	speakers: readonly ParticipantReference[];
	description: string;
}>;

export type EventPublicationLinks = Readonly<{
	meetup?: string;
	community?: string;
	assets?: string;
}>;

export type EventConfirmations = Readonly<{
	host: boolean;
	speakers: boolean;
}>;

export type EventLogisticsIntent = "planned" | "not-planned" | "unspecified";

export type EventLogistics = Readonly<{
	aperitif: EventLogisticsIntent;
	postEventVenue: EventLogisticsIntent;
}>;

export type OperationalChecklistItem = Readonly<{
	name: string;
	completed: boolean;
}>;

export type EventOperationalChecklists = Readonly<{
	slidesAndContent: readonly OperationalChecklistItem[];
	communication: readonly OperationalChecklistItem[];
	postEvent: readonly OperationalChecklistItem[];
}>;

export const POST_EVENT_TASK_NAMES = Object.freeze({
	thankHost: "Mail thanks hoster",
	thankSpeakers: "Mail thanks speakers",
	shareSlides: "Share slides to meetup",
	importAttendance: "Sync attendees from tally sheet to CNCF",
	shareOnSocialNetworks: "Social networks",
} as const);

export const EXPECTED_POST_EVENT_TASK_NAMES = Object.freeze([
	POST_EVENT_TASK_NAMES.thankHost,
	POST_EVENT_TASK_NAMES.thankSpeakers,
	POST_EVENT_TASK_NAMES.shareSlides,
	POST_EVENT_TASK_NAMES.importAttendance,
	POST_EVENT_TASK_NAMES.shareOnSocialNetworks,
] as const);

/**
 * A post-event checklist is complete only when it contains each expected task
 * exactly once, contains no additional task, and every task is completed.
 */
export function postEventChecklistIsComplete(
	items: readonly OperationalChecklistItem[],
): boolean {
	if (items.length !== EXPECTED_POST_EVENT_TASK_NAMES.length) {
		return false;
	}

	const itemByName = new Map<string, OperationalChecklistItem>();
	for (const item of items) {
		if (itemByName.has(item.name)) {
			return false;
		}
		itemByName.set(item.name, item);
	}

	return EXPECTED_POST_EVENT_TASK_NAMES.every(
		(name) => itemByName.get(name)?.completed === true,
	);
}

/**
 * Technology-independent representation of a meetup event.
 *
 * Fields may be empty while an event is being drafted. Invalid transport
 * values are reported by a document codec before this model is constructed.
 */
export type MeetupEvent = Readonly<{
	schemaVersion: typeof EVENT_SCHEMA_VERSION;
	identity: EventIdentity;
	issueState: IssueState;
	issueTitle: string;
	labels: readonly string[];
	eventTitle: string;
	date: string;
	description: string;
	host?: ParticipantReference;
	agenda: readonly AgendaEntry[];
	publicationLinks: EventPublicationLinks;
	occurrenceStatus?: OccurrenceStatus;
	timeZone: string;
	confirmations: EventConfirmations;
	logistics: EventLogistics;
	operationalChecklists: EventOperationalChecklists;
	/** Validated projection; lifecycle also verifies the exact named checklist. */
	followUpComplete: boolean;
}>;

export function cloneMeetupEvent(event: MeetupEvent): MeetupEvent {
	const operationalChecklists = {
		slidesAndContent: event.operationalChecklists.slidesAndContent.map(
			(item) => ({ ...item }),
		),
		communication: event.operationalChecklists.communication.map((item) => ({
			...item,
		})),
		postEvent: event.operationalChecklists.postEvent.map((item) => ({
			...item,
		})),
	};
	return {
		...event,
		identity: { ...event.identity },
		labels: [...event.labels],
		host: event.host ? { ...event.host } : undefined,
		agenda: event.agenda.map((entry) => ({
			...entry,
			speakers: entry.speakers.map((speaker) => ({ ...speaker })),
		})),
		publicationLinks: { ...event.publicationLinks },
		confirmations: { ...event.confirmations },
		logistics: { ...event.logistics },
		operationalChecklists,
		followUpComplete:
			event.followUpComplete &&
			postEventChecklistIsComplete(operationalChecklists.postEvent),
	};
}
