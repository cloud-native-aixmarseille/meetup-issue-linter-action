import {
	diagnostic,
	type EventDiagnostic,
	type EventDocument,
	type EventDocumentCodec,
	type EventDocumentDecodeResult,
	type EventLogisticsIntent,
	type EventRepositoryPatch,
	type MeetupEvent,
	migrateMeetupEventDto,
	type OperationalChecklistItem,
	type ParticipantReference,
	postEventChecklistIsComplete,
} from "@meetup-automation/event";

const CURRENT_SCHEMA_MARKER = "<!-- meetup-event-schema:1 -->";
const SCHEMA_MARKER_NAME = "meetup-event-schema";
const REFERENCE_MARKER_NAME = "meetup-event-references";
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

const HEADINGS = Object.freeze({
	eventTitle: "Event Title",
	date: "Event Date",
	host: "Hoster",
	description: "Event Description",
	agenda: "Agenda",
	meetupLink: "Meetup Link",
	communityLink: "CNCF Link",
	assetsLink: "Drive Link",
	slides: "Slides & Content",
	communication: "Communication",
	aperitif: "Aperitif",
	restaurant: "Restaurant / Bar",
	postEvent: "Post event",
	occurrenceStatus: "Event Status",
});

export interface GitHubIssueFormEventDocumentCodecOptions {
	readonly timeZone?: string;
	readonly hostConfirmationLabel?: string;
	readonly speakersConfirmationLabel?: string;
}

type LegacyReferenceMetadata = Readonly<{
	hostId: string | null;
	agendaSpeakerIds: readonly (readonly (string | null)[])[];
}>;

type StableReferenceBinding = Readonly<{
	id: string;
	displayName: string;
}>;

type StableReferenceMetadata = Readonly<{
	schemaVersion: 2;
	host: StableReferenceBinding | null;
	speakers: readonly StableReferenceBinding[];
}>;

type ParsedReferenceMetadata =
	| Readonly<{ kind: "bound"; value: StableReferenceMetadata }>
	| Readonly<{ kind: "legacy"; value: LegacyReferenceMetadata }>;

type Section = Readonly<{
	heading: string;
	headingStart: number;
	contentStart: number;
	contentEnd: number;
	value: string;
}>;

type Checkbox = Readonly<{
	checked: boolean;
	label: string;
}>;

type ManagedMarkerMatch = Readonly<{
	start: number;
	end: number;
	value: string;
}>;

export class GitHubIssueFormEventDocumentCodec implements EventDocumentCodec {
	private readonly timeZone: string;
	private readonly hostConfirmationLabel: string;
	private readonly speakersConfirmationLabel: string;

	constructor(options: GitHubIssueFormEventDocumentCodecOptions = {}) {
		this.timeZone = options.timeZone ?? "Europe/Paris";
		this.hostConfirmationLabel =
			options.hostConfirmationLabel ?? "hoster:confirmed";
		this.speakersConfirmationLabel =
			options.speakersConfirmationLabel ?? "speakers:confirmed";
	}

	decode(document: EventDocument): EventDocumentDecodeResult {
		const diagnostics: EventDiagnostic[] = [];
		const sections = parseSections(document.body);
		const schema = this.readSchema(document.body, diagnostics);
		const parsedBody = {
			event_title: this.readSection(
				sections,
				HEADINGS.eventTitle,
				true,
				diagnostics,
			),
			event_date: this.readSection(sections, HEADINGS.date, true, diagnostics),
			hoster: [
				this.readSection(sections, HEADINGS.host, true, diagnostics),
			].filter(Boolean),
			event_description: this.readSection(
				sections,
				HEADINGS.description,
				true,
				diagnostics,
			),
			agenda: this.readSection(sections, HEADINGS.agenda, true, diagnostics),
			meetup_link: this.readSection(
				sections,
				HEADINGS.meetupLink,
				false,
				diagnostics,
			),
			cncf_link: this.readSection(
				sections,
				HEADINGS.communityLink,
				false,
				diagnostics,
			),
			drive_link: this.readSection(
				sections,
				HEADINGS.assetsLink,
				false,
				diagnostics,
			),
			event_status: this.readSection(
				sections,
				HEADINGS.occurrenceStatus,
				false,
				diagnostics,
			),
		};

		const slidesAndContent = toOperationalChecklist(
			this.readCheckboxes(sections, HEADINGS.slides, diagnostics),
		);
		const communication = toOperationalChecklist(
			this.readCheckboxes(sections, HEADINGS.communication, diagnostics),
		);
		const postEventDiagnosticOffset = diagnostics.length;
		const postEvent = toOperationalChecklist(
			this.readCheckboxes(sections, HEADINGS.postEvent, diagnostics),
		);
		const postEventChecklistIsValid =
			diagnostics.length === postEventDiagnosticOffset;
		const followUpComplete =
			postEventChecklistIsValid && postEventChecklistIsComplete(postEvent);
		const logistics = {
			aperitif: this.readLogisticsIntent(
				sections,
				HEADINGS.aperitif,
				diagnostics,
			),
			postEventVenue: this.readLogisticsIntent(
				sections,
				HEADINGS.restaurant,
				diagnostics,
			),
		};

		const migrated = migrateMeetupEventDto({
			repository: document.identity.repository,
			issueNumber: document.identity.issueNumber,
			issueState: document.issueState,
			issueTitle: document.issueTitle,
			labels: document.labels,
			parsedBody,
			timeZone: this.timeZone,
		});
		diagnostics.push(
			...migrated.diagnostics.filter(
				(item) => schema === 0 || item.code !== "event.document.legacy-schema",
			),
		);

		let event: MeetupEvent = {
			...migrated.event,
			confirmations: {
				host: document.labels.includes(this.hostConfirmationLabel),
				speakers: document.labels.includes(this.speakersConfirmationLabel),
			},
			logistics,
			operationalChecklists: {
				slidesAndContent,
				communication,
				postEvent,
			},
			followUpComplete,
		};
		const metadata = this.readReferenceMetadata(document.body, diagnostics);
		if (metadata) {
			event = this.applyReferenceMetadata(event, metadata, diagnostics);
		} else if (schema === 1) {
			diagnostics.push(
				diagnostic({
					code: "event.document.reference-metadata.missing",
					severity: "warning",
					category: "migration",
					message: "Stable reference metadata is missing",
					fixAvailable: true,
				}),
			);
		}

		return {
			event,
			diagnostics: Object.freeze(diagnostics),
		};
	}

	createPatch(
		document: EventDocument,
		event: MeetupEvent,
	): EventRepositoryPatch {
		const patch: {
			issueTitle?: string;
			labels?: readonly string[];
			body?: string;
		} = {};

		if (document.issueTitle !== event.issueTitle) {
			patch.issueTitle = event.issueTitle;
		}
		if (!arraysEqual(document.labels, event.labels)) {
			patch.labels = Object.freeze([...event.labels]);
		}

		let body = document.body;
		body = replaceOrAppendSection(body, HEADINGS.eventTitle, event.eventTitle);
		body = replaceOrAppendSection(body, HEADINGS.date, event.date);
		body = replaceOrAppendSection(
			body,
			HEADINGS.host,
			event.host ? event.host.displayName : "",
		);
		body = replaceOrAppendSection(
			body,
			HEADINGS.description,
			event.description,
		);
		body = replaceOrAppendSection(body, HEADINGS.agenda, renderAgenda(event));
		body = replaceOrAppendSection(
			body,
			HEADINGS.meetupLink,
			event.publicationLinks.meetup ?? "",
		);
		body = replaceOrAppendSection(
			body,
			HEADINGS.communityLink,
			event.publicationLinks.community ?? "",
		);
		body = replaceOrAppendSection(
			body,
			HEADINGS.assetsLink,
			event.publicationLinks.assets ?? "",
		);
		body = removeSection(body, HEADINGS.occurrenceStatus);
		body = replaceOrAppendOperationalChecklist(
			body,
			HEADINGS.slides,
			renderOperationalChecklist(event.operationalChecklists.slidesAndContent),
		);
		body = replaceOrAppendOperationalChecklist(
			body,
			HEADINGS.communication,
			renderOperationalChecklist(event.operationalChecklists.communication),
		);
		body = replaceOrAppendLogisticsIntent(
			body,
			HEADINGS.aperitif,
			event.logistics.aperitif,
		);
		body = replaceOrAppendLogisticsIntent(
			body,
			HEADINGS.restaurant,
			event.logistics.postEventVenue,
		);
		body = replaceOrAppendOperationalChecklist(
			body,
			HEADINGS.postEvent,
			renderOperationalChecklist(event.operationalChecklists.postEvent),
		);
		body = upsertManagedMarkers(body, referenceMetadata(event));

		if (body !== document.body) {
			patch.body = body;
		}

		return Object.freeze(patch);
	}

	private readSchema(body: string, diagnostics: EventDiagnostic[]): 0 | 1 {
		const markers = readManagedMarkerValues(body, SCHEMA_MARKER_NAME);
		if (markers.length === 0) {
			return 0;
		}
		if (markers.length > 1) {
			diagnostics.push(
				diagnostic({
					code: "event.document.schema-marker.duplicate",
					severity: "error",
					category: "invalid",
					message: "The event document contains duplicate schema markers",
					fixAvailable: true,
				}),
			);
		}
		if (markers[0] !== "1") {
			diagnostics.push(
				diagnostic({
					code: "event.document.schema-version.unsupported",
					severity: "error",
					category: "migration",
					message: "The event document schema version is unsupported",
				}),
			);
			return 0;
		}
		return 1;
	}

	private readSection(
		sections: ReadonlyMap<string, readonly Section[]>,
		heading: string,
		required: boolean,
		diagnostics: EventDiagnostic[],
	): string {
		const matches = sections.get(heading) ?? [];
		if (matches.length === 0) {
			if (required) {
				diagnostics.push(
					diagnostic({
						code: "event.document.heading.missing",
						severity: "error",
						category: "invalid",
						field: heading,
						message: `The ${heading} heading is missing`,
						fixAvailable: true,
					}),
				);
			}
			return "";
		}
		if (matches.length > 1) {
			diagnostics.push(
				diagnostic({
					code: "event.document.heading.duplicate",
					severity: "error",
					category: "invalid",
					field: heading,
					message: `The ${heading} heading occurs more than once`,
				}),
			);
		}
		return cleanResponse(matches[0].value);
	}

	private readCheckboxes(
		sections: ReadonlyMap<string, readonly Section[]>,
		heading: string,
		diagnostics: EventDiagnostic[],
	): readonly Checkbox[] {
		const matches = sections.get(heading) ?? [];
		if (matches.length > 1) {
			diagnostics.push(
				diagnostic({
					code: "event.document.heading.duplicate",
					severity: "error",
					category: "invalid",
					field: heading,
					message: `The ${heading} heading occurs more than once`,
				}),
			);
		}
		const value = cleanResponse(matches[0]?.value ?? "");
		if (!value) {
			return [];
		}

		const checkboxes: Checkbox[] = [];
		for (const [index, line] of value.split(/\r?\n/).entries()) {
			if (!line.trim()) {
				continue;
			}
			const checkbox = parseCheckboxLine(line);
			if (!checkbox) {
				diagnostics.push(
					diagnostic({
						code: "event.document.checkbox.invalid",
						severity: "warning",
						category: "invalid",
						field: heading,
						message: `${heading} checklist line ${index + 1} is malformed`,
					}),
				);
				continue;
			}
			checkboxes.push(checkbox);
		}
		return checkboxes;
	}

	private readLogisticsIntent(
		sections: ReadonlyMap<string, readonly Section[]>,
		heading: string,
		diagnostics: EventDiagnostic[],
	): EventLogisticsIntent {
		const value = this.readSection(sections, heading, false, diagnostics);
		if (!value) {
			return "unspecified";
		}
		if (value.toLocaleLowerCase("en-US") === "yes") {
			return "planned";
		}
		if (value.toLocaleLowerCase("en-US") === "no") {
			return "not-planned";
		}

		diagnostics.push(
			diagnostic({
				code: "event.logistics.intent.invalid",
				severity: "error",
				category: "invalid",
				field: heading,
				message: `${heading} must be Yes or No when specified`,
			}),
		);
		return "unspecified";
	}

	private readReferenceMetadata(
		body: string,
		diagnostics: EventDiagnostic[],
	): ParsedReferenceMetadata | undefined {
		const markers = readManagedMarkerValues(body, REFERENCE_MARKER_NAME);
		if (markers.length === 0) {
			return undefined;
		}
		if (markers.length > 1) {
			diagnostics.push(
				diagnostic({
					code: "event.document.reference-metadata.duplicate",
					severity: "error",
					category: "invalid",
					message: "The event document contains duplicate reference metadata",
					fixAvailable: true,
				}),
			);
		}

		try {
			const parsed = JSON.parse(markers[0]) as unknown;
			if (isReferenceMetadata(parsed)) {
				return { kind: "bound", value: parsed };
			}
			if (isLegacyReferenceMetadata(parsed)) {
				return { kind: "legacy", value: parsed };
			}
			throw new Error("invalid metadata shape");
		} catch {
			diagnostics.push(
				diagnostic({
					code: "event.document.reference-metadata.invalid",
					severity: "error",
					category: "invalid",
					message: "Stable reference metadata is malformed",
					fixAvailable: true,
				}),
			);
			return undefined;
		}
	}

	private applyReferenceMetadata(
		event: MeetupEvent,
		metadata: ParsedReferenceMetadata,
		diagnostics: EventDiagnostic[],
	): MeetupEvent {
		if (metadata.kind === "legacy") {
			diagnostics.push(legacyMetadataDiagnostic());
			return event;
		}

		const boundMetadata = metadata.value;
		const restored: MeetupEvent = {
			...event,
			host: restoreBoundReference(event.host, boundMetadata.host),
			agenda: event.agenda.map((entry) => ({
				...entry,
				speakers: entry.speakers.map((speaker) =>
					restoreBoundSpeaker(speaker, boundMetadata.speakers),
				),
			})),
		};

		if (!referenceMetadataEqual(boundMetadata, referenceMetadata(restored))) {
			diagnostics.push(staleMetadataDiagnostic());
		}

		return restored;
	}
}

function parseSections(body: string): ReadonlyMap<string, readonly Section[]> {
	const sections = new Map<string, Section[]>();
	let pending:
		| Readonly<{ heading: string; headingStart: number; contentStart: number }>
		| undefined;

	for (let cursor = 0; cursor < body.length; ) {
		const lineEnd = findLineEnd(body, cursor);
		const nextLineStart = findNextLineStart(body, lineEnd);
		const heading = parseHeadingLine(body.slice(cursor, lineEnd));

		if (heading !== undefined) {
			if (pending) {
				appendSection(sections, {
					heading: pending.heading,
					headingStart: pending.headingStart,
					contentStart: pending.contentStart,
					contentEnd: cursor,
					value: body.slice(pending.contentStart, cursor),
				});
			}
			pending = {
				heading,
				headingStart: cursor,
				contentStart: nextLineStart,
			};
		}

		cursor = nextLineStart;
	}

	if (pending) {
		appendSection(sections, {
			heading: pending.heading,
			headingStart: pending.headingStart,
			contentStart: pending.contentStart,
			contentEnd: body.length,
			value: body.slice(pending.contentStart),
		});
	}

	return sections;
}

function cleanResponse(value: string): string {
	const trimmed = value.trim();
	return trimmed === "_No response_" ? "" : trimmed;
}

function replaceOrAppendSection(
	body: string,
	heading: string,
	value: string,
): string {
	const section = parseSections(body).get(heading)?.[0];
	const normalizedValue = value.trim();
	if (!section) {
		if (!normalizedValue) {
			return body;
		}
		const separator = body.length === 0 || body.endsWith("\n\n") ? "" : "\n\n";
		return `${body}${separator}### ${heading}\n\n${normalizedValue}\n`;
	}
	if (cleanResponse(section.value) === normalizedValue) {
		return body;
	}
	return `${body.slice(0, section.contentStart)}\n${normalizedValue}\n\n${body.slice(section.contentEnd)}`;
}

function removeSection(body: string, heading: string): string {
	const section = parseSections(body).get(heading)?.[0];
	if (!section) {
		return body;
	}

	const before = trimTrailingWhitespace(body.slice(0, section.headingStart));
	const after = trimLeadingWhitespace(body.slice(section.contentEnd));
	if (before === "") {
		return after;
	}
	if (after === "") {
		return `${before}\n`;
	}
	return `${before}\n\n${after}`;
}

function replaceOrAppendOperationalChecklist(
	body: string,
	heading: string,
	value: string,
): string {
	const sections = parseSections(body).get(heading) ?? [];
	if (
		sections.length > 1 ||
		(sections[0] && !operationalChecklistIsWellFormed(sections[0].value))
	) {
		return body;
	}
	return replaceOrAppendSection(body, heading, value);
}

function operationalChecklistIsWellFormed(value: string): boolean {
	const cleaned = cleanResponse(value);
	return (
		cleaned === "" ||
		cleaned
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "")
			.every((line) => parseCheckboxLine(line) !== undefined)
	);
}

function replaceOrAppendLogisticsIntent(
	body: string,
	heading: string,
	intent: EventLogisticsIntent,
): string {
	return intent === "unspecified" ||
		(parseSections(body).get(heading)?.length ?? 0) > 1
		? body
		: replaceOrAppendSection(body, heading, renderLogisticsIntent(intent));
}

function renderAgenda(event: MeetupEvent): string {
	return event.agenda
		.map(
			(entry) =>
				`- ${entry.speakers.map((speaker) => speaker.displayName).join(", ")}: ${entry.description}`,
		)
		.join("\n");
}

function toOperationalChecklist(
	checkboxes: readonly Checkbox[],
): readonly OperationalChecklistItem[] {
	return checkboxes.map(({ checked, label }) => ({
		name: label,
		completed: checked,
	}));
}

function renderOperationalChecklist(
	items: readonly OperationalChecklistItem[],
): string {
	return items
		.map(({ name, completed }) => `- [${completed ? "x" : " "}] ${name}`)
		.join("\n");
}

function renderLogisticsIntent(intent: EventLogisticsIntent): string {
	switch (intent) {
		case "planned":
			return "Yes";
		case "not-planned":
			return "No";
		case "unspecified":
			return "";
	}
}

function referenceMetadata(event: MeetupEvent): StableReferenceMetadata {
	return {
		schemaVersion: 2,
		host: event.host?.id ? referenceBinding(event.host, event.host.id) : null,
		speakers: event.agenda.flatMap((entry) =>
			entry.speakers.flatMap((speaker) =>
				speaker.id ? [referenceBinding(speaker, speaker.id)] : [],
			),
		),
	};
}

function upsertManagedMarkers(
	body: string,
	metadata: StableReferenceMetadata,
): string {
	const referenceMarker = `<!-- meetup-event-references:${JSON.stringify(metadata)} -->`;
	const schemaReplacement = replaceManagedMarker(
		body,
		SCHEMA_MARKER_NAME,
		CURRENT_SCHEMA_MARKER,
	);
	const referenceReplacement = replaceManagedMarker(
		schemaReplacement.body,
		REFERENCE_MARKER_NAME,
		referenceMarker,
	);
	let result = referenceReplacement.body;

	if (!schemaReplacement.found) {
		result = `${CURRENT_SCHEMA_MARKER}\n${result}`;
	}
	if (!referenceReplacement.found) {
		result = result.replace(
			CURRENT_SCHEMA_MARKER,
			`${CURRENT_SCHEMA_MARKER}\n${referenceMarker}`,
		);
	}
	return result;
}

function isReferenceMetadata(value: unknown): value is StableReferenceMetadata {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	if (candidate.schemaVersion !== 2) {
		return false;
	}
	if (candidate.host !== null && !isReferenceBinding(candidate.host)) {
		return false;
	}
	return (
		Array.isArray(candidate.speakers) &&
		candidate.speakers.every(isReferenceBinding)
	);
}

function isLegacyReferenceMetadata(
	value: unknown,
): value is LegacyReferenceMetadata {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	if (
		candidate.hostId !== null &&
		(typeof candidate.hostId !== "string" ||
			!STABLE_ID_PATTERN.test(candidate.hostId))
	) {
		return false;
	}
	if (!Array.isArray(candidate.agendaSpeakerIds)) {
		return false;
	}
	return candidate.agendaSpeakerIds.every(
		(entry) =>
			Array.isArray(entry) &&
			entry.every(
				(id) =>
					id === null || (typeof id === "string" && STABLE_ID_PATTERN.test(id)),
			),
	);
}

function isReferenceBinding(value: unknown): value is StableReferenceBinding {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.id === "string" &&
		STABLE_ID_PATTERN.test(candidate.id) &&
		typeof candidate.displayName === "string" &&
		candidate.displayName.length > 0 &&
		candidate.displayName === normalizeVisibleDisplayName(candidate.displayName)
	);
}

function referenceBinding(
	participant: ParticipantReference,
	id: string,
): StableReferenceBinding {
	return {
		id,
		displayName: normalizeVisibleDisplayName(participant.displayName),
	};
}

function readManagedMarkerValues(
	body: string,
	markerName: string,
): readonly string[] {
	return findManagedMarkerMatches(body, markerName).map(({ value }) => value);
}

function replaceManagedMarker(
	body: string,
	markerName: string,
	replacement: string,
): Readonly<{ body: string; found: boolean }> {
	const matches = findManagedMarkerMatches(body, markerName);
	if (matches.length === 0) {
		return { body, found: false };
	}

	let result = "";
	let lastIndex = 0;
	for (const [index, match] of matches.entries()) {
		result += body.slice(lastIndex, match.start);
		if (index === 0) {
			result += replacement;
		}
		lastIndex = match.end;
	}
	result += body.slice(lastIndex);

	return { body: result, found: true };
}

function findManagedMarkerMatches(
	body: string,
	markerName: string,
): readonly ManagedMarkerMatch[] {
	const matches: ManagedMarkerMatch[] = [];

	for (let cursor = 0; cursor < body.length; ) {
		const commentStart = body.indexOf("<!--", cursor);
		if (commentStart === -1) {
			break;
		}

		const commentEnd = body.indexOf("-->", commentStart + 4);
		if (commentEnd === -1) {
			break;
		}

		const value = parseManagedMarkerComment(
			body.slice(commentStart + 4, commentEnd),
			markerName,
		);
		if (value !== undefined) {
			matches.push({
				start: commentStart,
				end: commentEnd + 3,
				value,
			});
		}

		cursor = commentEnd + 3;
	}

	return matches;
}

function parseManagedMarkerComment(
	commentBody: string,
	markerName: string,
): string | undefined {
	const trimmed = commentBody.trim();
	if (!trimmed.startsWith(markerName)) {
		return undefined;
	}

	let cursor = markerName.length;
	while (cursor < trimmed.length && isWhitespaceCharacter(trimmed[cursor])) {
		cursor += 1;
	}
	if (trimmed[cursor] !== ":") {
		return undefined;
	}

	return trimmed.slice(cursor + 1).trim();
}

function appendSection(
	sections: Map<string, Section[]>,
	section: Section,
): void {
	const existing = sections.get(section.heading) ?? [];
	sections.set(section.heading, [...existing, section]);
}

function parseHeadingLine(line: string): string | undefined {
	if (!line.startsWith("### ")) {
		return undefined;
	}

	const rawHeading = line.slice(4);
	if (rawHeading.length === 0) {
		return undefined;
	}

	let end = rawHeading.length;
	while (end > 1 && isHorizontalWhitespaceCharacter(rawHeading[end - 1])) {
		end -= 1;
	}
	return rawHeading.slice(0, end).trim();
}

function parseCheckboxLine(line: string): Checkbox | undefined {
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
	if (line[cursor] !== "[") {
		return undefined;
	}

	const checkedMarker = line[cursor + 1];
	if (
		(checkedMarker !== " " && checkedMarker !== "x" && checkedMarker !== "X") ||
		line[cursor + 2] !== "]"
	) {
		return undefined;
	}

	cursor += 3;
	if (!isHorizontalWhitespaceCharacter(line[cursor] ?? "")) {
		return undefined;
	}
	while (
		cursor < line.length &&
		isHorizontalWhitespaceCharacter(line[cursor])
	) {
		cursor += 1;
	}

	const label = line.slice(cursor).trim();
	if (label === "") {
		return undefined;
	}

	return {
		checked: checkedMarker.toLowerCase() === "x",
		label,
	};
}

function findLineEnd(value: string, start: number): number {
	let cursor = start;
	while (
		cursor < value.length &&
		value[cursor] !== "\n" &&
		value[cursor] !== "\r"
	) {
		cursor += 1;
	}
	return cursor;
}

function findNextLineStart(value: string, lineEnd: number): number {
	if (lineEnd >= value.length) {
		return value.length;
	}
	if (value[lineEnd] === "\r" && value[lineEnd + 1] === "\n") {
		return lineEnd + 2;
	}
	return lineEnd + 1;
}

function trimLeadingWhitespace(value: string): string {
	let start = 0;
	while (start < value.length && isWhitespaceCharacter(value[start])) {
		start += 1;
	}
	return value.slice(start);
}

function trimTrailingWhitespace(value: string): string {
	let end = value.length;
	while (end > 0 && isWhitespaceCharacter(value[end - 1])) {
		end -= 1;
	}
	return value.slice(0, end);
}

function isHorizontalWhitespaceCharacter(value: string): boolean {
	return value === " " || value === "\t";
}

function isWhitespaceCharacter(value: string): boolean {
	return (
		value === " " ||
		value === "\t" ||
		value === "\n" ||
		value === "\r" ||
		value === "\f" ||
		value === "\v"
	);
}

function normalizeVisibleDisplayName(displayName: string): string {
	return displayName.trim().replace(/\s+/g, " ");
}

function restoreBoundReference(
	participant: ParticipantReference | undefined,
	binding: StableReferenceBinding | null,
): ParticipantReference | undefined {
	if (!participant || participant.id || !binding) {
		return participant;
	}
	return normalizeVisibleDisplayName(participant.displayName) ===
		binding.displayName
		? { ...participant, id: binding.id }
		: participant;
}

function restoreBoundSpeaker(
	participant: ParticipantReference,
	bindings: readonly StableReferenceBinding[],
): ParticipantReference {
	if (participant.id) {
		return participant;
	}

	const visibleName = normalizeVisibleDisplayName(participant.displayName);
	const matchingIds = new Set(
		bindings
			.filter(({ displayName }) => displayName === visibleName)
			.map(({ id }) => id),
	);
	if (matchingIds.size !== 1) {
		return participant;
	}
	const id = matchingIds.values().next().value;
	return id ? { ...participant, id } : participant;
}

function referenceMetadataEqual(
	left: StableReferenceMetadata,
	right: StableReferenceMetadata,
): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function legacyMetadataDiagnostic(): EventDiagnostic {
	return diagnostic({
		code: "event.document.reference-metadata.legacy",
		severity: "warning",
		category: "migration",
		message:
			"Unbound stable reference metadata cannot safely restore participant IDs",
		fixAvailable: true,
	});
}

function staleMetadataDiagnostic(): EventDiagnostic {
	return diagnostic({
		code: "event.document.reference-metadata.stale",
		severity: "warning",
		category: "migration",
		message: "Stable reference metadata does not match visible participants",
		fixAvailable: true,
	});
}

function arraysEqual(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}
