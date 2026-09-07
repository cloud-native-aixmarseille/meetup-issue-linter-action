import { diagnostic, type EventDiagnostic } from "./diagnostic.js";
import {
	type AgendaEntry,
	cloneMeetupEvent,
	EVENT_SCHEMA_VERSION,
	type MeetupEvent,
	type OccurrenceStatus,
	type ParticipantReference,
} from "./model.js";

export type LegacyMeetupIssueBodyDto = Readonly<{
	event_date?: unknown;
	event_title?: unknown;
	hoster?: unknown;
	event_description?: unknown;
	agenda?: unknown;
	meetup_link?: unknown;
	cncf_link?: unknown;
	drive_link?: unknown;
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

const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

const OCCURRENCE_STATUSES: readonly OccurrenceStatus[] = [
	"scheduled",
	"postponed",
	"held",
	"cancelled",
];

const OCCURRENCE_STATUS_LABELS: Readonly<
	Record<OccurrenceStatus, string | null>
> = Object.freeze({
	scheduled: null,
	postponed: "event:postponed",
	held: "event:held",
	cancelled: "event:cancelled",
});

export function migrateMeetupEventDto(
	dto: MeetupEventDto,
): EventDtoMigrationResult {
	if (dto.schemaVersion === EVENT_SCHEMA_VERSION) {
		return {
			event: cloneMeetupEvent(dto),
			diagnostics: [],
		};
	}

	return migrateLegacyDto(dto);
}

function migrateLegacyDto(dto: LegacyMeetupEventDto): EventDtoMigrationResult {
	const diagnostics: EventDiagnostic[] = [];
	const body = dto.parsedBody;

	const eventTitle = readString(body.event_title, "event_title", diagnostics);
	const date = readString(body.event_date, "event_date", diagnostics);
	const description = readString(
		body.event_description,
		"event_description",
		diagnostics,
	);
	const host = readLegacyHost(body.hoster, diagnostics);
	const agenda = readLegacyAgenda(body.agenda, diagnostics);
	const occurrenceStatus = readOccurrenceStatus(
		dto.labels ?? [],
		dto.issueState ?? "open",
		body.event_status,
		diagnostics,
	);

	const event: MeetupEvent = {
		schemaVersion: EVENT_SCHEMA_VERSION,
		identity: {
			repository: dto.repository,
			issueNumber: dto.issueNumber,
		},
		issueState: dto.issueState ?? "open",
		issueTitle: dto.issueTitle,
		labels: [...(dto.labels ?? [])],
		eventTitle,
		date,
		description,
		host,
		agenda,
		publicationLinks: {
			meetup: readOptionalString(body.meetup_link, "meetup_link", diagnostics),
			community: readOptionalString(body.cncf_link, "cncf_link", diagnostics),
			assets: readOptionalString(body.drive_link, "drive_link", diagnostics),
		},
		occurrenceStatus,
		timeZone: dto.timeZone ?? "Europe/Paris",
		confirmations: {
			host: dto.labels?.includes("hoster:confirmed") ?? false,
			speakers: dto.labels?.includes("speakers:confirmed") ?? false,
		},
		logistics: {
			aperitif: "unspecified",
			postEventVenue: "unspecified",
		},
		operationalChecklists: {
			slidesAndContent: [],
			communication: [],
			postEvent: [],
		},
		// A legacy flag has no named task evidence and cannot prove completion.
		followUpComplete: false,
	};

	diagnostics.unshift(
		diagnostic({
			code: "event.document.legacy-schema",
			severity: "info",
			category: "migration",
			message: "The legacy event document was migrated to schema version 1",
			fixAvailable: true,
		}),
	);

	return { event, diagnostics };
}

function readString(
	value: unknown,
	field: string,
	diagnostics: EventDiagnostic[],
): string {
	if (value === undefined || value === null) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	diagnostics.push(
		diagnostic({
			code: "event.document.invalid-field-type",
			severity: "error",
			category: "invalid",
			field,
			message: `The ${field} field must be a string`,
		}),
	);
	return "";
}

function readOptionalString(
	value: unknown,
	field: string,
	diagnostics: EventDiagnostic[],
): string | undefined {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}
	return readString(value, field, diagnostics);
}

function readLegacyHost(
	value: unknown,
	diagnostics: EventDiagnostic[],
): ParticipantReference | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (!Array.isArray(value)) {
		diagnostics.push(
			diagnostic({
				code: "event.document.invalid-hoster-type",
				severity: "error",
				category: "invalid",
				field: "hoster",
				message: "The legacy hoster field must be an array",
			}),
		);
		return undefined;
	}

	if (value.length > 1) {
		diagnostics.push(
			diagnostic({
				code: "event.hoster.multiple",
				severity: "error",
				category: "invalid",
				field: "hoster",
				message: "A meetup event must have exactly one host",
			}),
		);
	}

	const first = value[0];
	if (first === undefined) {
		return undefined;
	}
	if (typeof first !== "string") {
		diagnostics.push(
			diagnostic({
				code: "event.document.invalid-hoster-entry",
				severity: "error",
				category: "invalid",
				field: "hoster",
				message: "The legacy hoster entry must be a string",
			}),
		);
		return undefined;
	}

	return parseParticipantReference(first);
}

function readLegacyAgenda(
	value: unknown,
	diagnostics: EventDiagnostic[],
): readonly AgendaEntry[] {
	if (value === undefined || value === null || value === "") {
		return [];
	}
	if (typeof value !== "string") {
		diagnostics.push(
			diagnostic({
				code: "event.document.invalid-agenda-type",
				severity: "error",
				category: "invalid",
				field: "agenda",
				message: "The legacy agenda field must be a string",
			}),
		);
		return [];
	}

	const entries: AgendaEntry[] = [];
	for (const [index, line] of value.split("\n").entries()) {
		if (line.trim() === "") {
			continue;
		}
		const agendaLine = parseLegacyAgendaLine(line);
		if (!agendaLine) {
			diagnostics.push(
				diagnostic({
					code: "event.agenda.legacy-line-invalid",
					severity: "error",
					category: "invalid",
					field: `agenda.${index}`,
					message: `Agenda line ${index + 1} does not match "- <speaker(s)>: <description>"`,
				}),
			);
			continue;
		}

		entries.push({
			speakers: agendaLine.speakers
				.split(",")
				.map((speaker) => parseParticipantReference(speaker)),
			description: agendaLine.description,
		});
	}
	return entries;
}

export function parseParticipantReference(value: string): ParticipantReference {
	const trimmed = value.trim();
	const markdownLinkLabel = parseMarkdownLinkLabel(trimmed);
	if (markdownLinkLabel !== undefined) {
		return { displayName: markdownLinkLabel };
	}

	const stableReference = parseStableIdReference(trimmed);
	if (stableReference) {
		return stableReference;
	}

	return { displayName: trimmed };
}

function parseLegacyAgendaLine(
	line: string,
): Readonly<{ speakers: string; description: string }> | undefined {
	let cursor = 0;
	while (
		cursor < line.length &&
		isHorizontalWhitespaceCharacter(line[cursor])
	) {
		cursor += 1;
	}
	if (line[cursor] !== "-") {
		return undefined;
	}

	cursor += 1;
	if (!isHorizontalWhitespaceCharacter(line[cursor] ?? "")) {
		return undefined;
	}
	while (
		cursor < line.length &&
		isHorizontalWhitespaceCharacter(line[cursor])
	) {
		cursor += 1;
	}

	const content = line.slice(cursor);
	for (let index = 0; index < content.length; index += 1) {
		if (content[index] !== ":") {
			continue;
		}
		if (!isHorizontalWhitespaceCharacter(content[index + 1] ?? "")) {
			continue;
		}

		const speakers = content.slice(0, index).trimEnd();
		if (speakers === "") {
			return undefined;
		}

		let descriptionStart = index + 1;
		while (
			descriptionStart < content.length &&
			isHorizontalWhitespaceCharacter(content[descriptionStart])
		) {
			descriptionStart += 1;
		}

		return {
			speakers,
			description: content.slice(descriptionStart),
		};
	}

	return undefined;
}

function parseMarkdownLinkLabel(value: string): string | undefined {
	if (!value.startsWith("[") || !value.endsWith(")")) {
		return undefined;
	}

	const closingBracket = value.indexOf("]");
	if (closingBracket <= 1 || value[closingBracket + 1] !== "(") {
		return undefined;
	}

	const target = value.slice(closingBracket + 2, -1);
	if (target === "" || target.includes(")")) {
		return undefined;
	}

	return value.slice(1, closingBracket).trim();
}

function parseStableIdReference(
	value: string,
): ParticipantReference | undefined {
	if (!value.endsWith("]")) {
		return undefined;
	}

	const openingBracket = value.lastIndexOf("[");
	if (
		openingBracket <= 0 ||
		!isWhitespaceCharacter(value[openingBracket - 1] ?? "")
	) {
		return undefined;
	}

	const id = value.slice(openingBracket + 1, -1);
	if (!STABLE_ID_PATTERN.test(id)) {
		return undefined;
	}

	const displayName = value.slice(0, openingBracket).trim();
	if (displayName === "") {
		return undefined;
	}

	return {
		displayName,
		id,
	};
}

function isHorizontalWhitespaceCharacter(value: string): boolean {
	return value === " " || value === "\t";
}

function isWhitespaceCharacter(value: string): boolean {
	return (
		isHorizontalWhitespaceCharacter(value) || value === "\n" || value === "\r"
	);
}

function readOccurrenceStatus(
	labels: readonly string[],
	issueState: "open" | "closed",
	legacyValue: unknown,
	diagnostics: EventDiagnostic[],
): OccurrenceStatus {
	const explicitStatuses = OCCURRENCE_STATUSES.filter((status) => {
		const label = OCCURRENCE_STATUS_LABELS[status];
		return label !== null && labels.includes(label);
	});

	if (explicitStatuses.length > 1) {
		diagnostics.push(
			diagnostic({
				code: "event.occurrence-status.label-conflict",
				severity: "error",
				category: "invalid",
				field: "labels",
				message:
					"Occurrence status labels are mutually exclusive; keep only one of event:postponed, event:held, or event:cancelled",
			}),
		);
		return (
			explicitStatuses[0] ?? (issueState === "closed" ? "held" : "scheduled")
		);
	}

	if (explicitStatuses.length === 1) {
		return explicitStatuses[0];
	}

	const legacyStatus = readLegacyOccurrenceStatus(legacyValue, diagnostics);
	if (legacyStatus !== undefined) {
		return legacyStatus;
	}

	return issueState === "closed" ? "held" : "scheduled";
}

function readLegacyOccurrenceStatus(
	value: unknown,
	diagnostics: EventDiagnostic[],
): OccurrenceStatus | undefined {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}
	if (
		typeof value === "string" &&
		OCCURRENCE_STATUSES.includes(value as OccurrenceStatus)
	) {
		return value as OccurrenceStatus;
	}

	diagnostics.push(
		diagnostic({
			code: "event.occurrence-status.invalid",
			severity: "error",
			category: "invalid",
			field: "event_status",
			message:
				"Occurrence status must be scheduled, postponed, held, or cancelled",
		}),
	);
	return undefined;
}
