import { diagnostic, type EventDiagnostic } from "./diagnostic.js";
import type {
	AgendaEntry,
	MeetupEvent,
	ParticipantReference,
} from "./model.js";
import {
	applyEventPatch,
	createEventPatch,
	EMPTY_EVENT_PATCH,
	type EventPatch,
	type EventPatchOperation,
	replaceEventField,
} from "./patch.js";

export type EventRuleResult = Readonly<{
	diagnostics: readonly EventDiagnostic[];
	patch: EventPatch;
}>;

export interface EventRule {
	readonly id: string;
	readonly dependencies: readonly string[];
	evaluate(event: MeetupEvent): EventRuleResult;
}

export class EventRuleConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EventRuleConfigurationError";
	}
}

export type EventRuleEngineResult = Readonly<{
	event: MeetupEvent;
	diagnostics: readonly EventDiagnostic[];
	patch: EventPatch;
}>;

/** Validates and sorts the rule graph once, before any event is processed. */
export class EventRuleEngine {
	private readonly orderedRules: readonly EventRule[];

	constructor(rules: readonly EventRule[]) {
		this.orderedRules = sortRules(rules);
	}

	evaluate(event: MeetupEvent): EventRuleEngineResult {
		let normalizedEvent = event;
		const diagnostics: EventDiagnostic[] = [];
		const operations: EventPatchOperation[] = [];

		for (const rule of this.orderedRules) {
			const result = rule.evaluate(normalizedEvent);
			diagnostics.push(...result.diagnostics);
			operations.push(...result.patch.operations);
			normalizedEvent = applyEventPatch(normalizedEvent, result.patch);
		}

		return {
			event: normalizedEvent,
			diagnostics: Object.freeze(diagnostics),
			patch: createEventPatch(operations),
		};
	}

	get ruleIds(): readonly string[] {
		return this.orderedRules.map((rule) => rule.id);
	}
}

export function createDefaultEventRules(
	labelConfiguration: ManagedLabelConfiguration = DEFAULT_MANAGED_LABEL_CONFIGURATION,
): readonly EventRule[] {
	return [
		new EventDateRule(),
		new EventTitleRule(),
		new EventDescriptionRule(),
		new EventHostRule(),
		new EventAgendaRule(),
		new EventLinksRule(),
		new IssueTitleRule(),
		new ManagedLabelsRule(labelConfiguration),
	];
}

export class EventDateRule implements EventRule {
	readonly id = "event-date";
	readonly dependencies: readonly string[] = [];

	evaluate(event: MeetupEvent): EventRuleResult {
		const value = event.date.trim();
		if (value === "") {
			return missing("event.date.missing", "date", "An event date is required");
		}
		if (!isValidIsoDate(value)) {
			return invalid(
				"event.date.invalid",
				"date",
				"Event date must be a real calendar date formatted as YYYY-MM-DD",
			);
		}
		return normalizeString(event.date, value, "date", "Normalize event date");
	}
}

export class EventTitleRule implements EventRule {
	readonly id = "event-title";
	readonly dependencies: readonly string[] = [];

	evaluate(event: MeetupEvent): EventRuleResult {
		const value = event.eventTitle.trim();
		if (value === "") {
			return missing(
				"event.title.missing",
				"eventTitle",
				"An event title is required",
			);
		}
		return normalizeString(
			event.eventTitle,
			value,
			"eventTitle",
			"Trim event title",
		);
	}
}

export class EventDescriptionRule implements EventRule {
	readonly id = "event-description";
	readonly dependencies: readonly string[] = [];

	evaluate(event: MeetupEvent): EventRuleResult {
		const value = event.description.trim();
		if (value === "") {
			return missing(
				"event.description.missing",
				"description",
				"An event description is required",
			);
		}
		return normalizeString(
			event.description,
			value,
			"description",
			"Trim event description",
		);
	}
}

export class EventHostRule implements EventRule {
	readonly id = "event-host";
	readonly dependencies: readonly string[] = [];

	evaluate(event: MeetupEvent): EventRuleResult {
		if (!event.host) {
			return missing("event.hoster.missing", "host", "A host must be selected");
		}

		const normalized = normalizeParticipant(event.host);
		if (normalized.displayName === "") {
			return invalid(
				"event.hoster.invalid",
				"host",
				"Host display name must not be empty",
			);
		}

		if (participantsEqual(event.host, normalized)) {
			return emptyResult();
		}

		return normalizedResult(
			replaceEventField("host", normalized, "Normalize host reference"),
			"event.hoster.normalized",
			"host",
			"The host reference can be normalized safely",
		);
	}
}

export class EventAgendaRule implements EventRule {
	readonly id = "event-agenda";
	readonly dependencies: readonly string[] = [];

	evaluate(event: MeetupEvent): EventRuleResult {
		if (event.agenda.length === 0) {
			return missing(
				"event.agenda.missing",
				"agenda",
				"At least one agenda entry is required",
			);
		}

		const diagnostics: EventDiagnostic[] = [];
		const normalizedEntries = event.agenda.map((entry, entryIndex) => {
			const normalized = normalizeAgendaEntry(entry);
			if (normalized.speakers.length === 0) {
				diagnostics.push(
					diagnostic({
						code: "event.agenda.speaker.missing",
						severity: "error",
						category: "invalid",
						field: `agenda.${entryIndex}.speakers`,
						message: "Each agenda entry must have at least one speaker",
					}),
				);
			}

			for (const [speakerIndex, speaker] of normalized.speakers.entries()) {
				if (speaker.displayName === "") {
					diagnostics.push(
						diagnostic({
							code: "event.agenda.speaker.invalid",
							severity: "error",
							category: "invalid",
							field: `agenda.${entryIndex}.speakers.${speakerIndex}`,
							message: "Speaker display name must not be empty",
						}),
					);
				}
			}

			if (normalized.description === "") {
				diagnostics.push(
					diagnostic({
						code: "event.agenda.description.missing",
						severity: "error",
						category: "invalid",
						field: `agenda.${entryIndex}.description`,
						message: "Agenda entry description must not be empty",
					}),
				);
			}
			return normalized;
		});

		const operations: EventPatchOperation[] = [];
		if (!agendaEqual(event.agenda, normalizedEntries)) {
			operations.push(
				replaceEventField("agenda", normalizedEntries, "Normalize agenda"),
			);
			diagnostics.push(
				diagnostic({
					code: "event.agenda.normalized",
					severity: "info",
					category: "normalization",
					field: "agenda",
					message: "The agenda can be normalized safely",
					fixAvailable: true,
				}),
			);
		}

		return {
			diagnostics,
			patch: createEventPatch(operations),
		};
	}
}

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
		} = { ...event.publicationLinks };
		let changed = false;

		for (const key of ["meetup", "community", "assets"] as const) {
			const link = event.publicationLinks[key];
			if (link === undefined || link.trim() === "") {
				continue;
			}

			const value = link.trim().replace(/\/$/, "");
			if (!isHttpsUrl(value)) {
				diagnostics.push(
					diagnostic({
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
			diagnostic({
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
			patch: createEventPatch([
				replaceEventField(
					"publicationLinks",
					normalized,
					"Trim publication links and remove trailing slashes",
				),
			]),
		};
	}
}

export class IssueTitleRule implements EventRule {
	readonly id = "issue-title";
	readonly dependencies = ["event-date", "event-title"];

	evaluate(event: MeetupEvent): EventRuleResult {
		if (!isValidIsoDate(event.date) || event.eventTitle === "") {
			return emptyResult();
		}

		const expected = `[Meetup] - ${event.date} - ${event.eventTitle}`;
		if (event.issueTitle === expected) {
			return emptyResult();
		}

		return normalizedResult(
			replaceEventField(
				"issueTitle",
				expected,
				"Project canonical issue title",
			),
			"event.issue-title.normalized",
			"issueTitle",
			`Issue title should be "${expected}"`,
		);
	}
}

export type ManagedLabelConfiguration = Readonly<{
	meetup: string;
	hostNeeded: string;
	hostConfirmed: string;
	speakersNeeded: string;
	speakersConfirmed: string;
	occurrencePostponed: string;
	occurrenceHeld: string;
	occurrenceCancelled: string;
}>;

export const DEFAULT_MANAGED_LABEL_CONFIGURATION: ManagedLabelConfiguration =
	Object.freeze({
		meetup: "meetup",
		hostNeeded: "hoster:needed",
		hostConfirmed: "hoster:confirmed",
		speakersNeeded: "speakers:needed",
		speakersConfirmed: "speakers:confirmed",
		occurrencePostponed: "event:postponed",
		occurrenceHeld: "event:held",
		occurrenceCancelled: "event:cancelled",
	});

export class ManagedLabelsRule implements EventRule {
	readonly id = "managed-labels";
	readonly dependencies = ["event-host", "event-agenda"];

	constructor(private readonly configuration: ManagedLabelConfiguration) {}

	evaluate(event: MeetupEvent): EventRuleResult {
		const managed = Object.values(this.configuration);
		const unmanaged = event.labels.filter((label) => !managed.includes(label));
		const occurrenceLabels =
			event.occurrenceStatus === "postponed"
				? [this.configuration.occurrencePostponed]
				: event.occurrenceStatus === "held"
					? [this.configuration.occurrenceHeld]
					: event.occurrenceStatus === "cancelled"
						? [this.configuration.occurrenceCancelled]
						: [];
		const expected = [
			...unmanaged,
			this.configuration.meetup,
			event.confirmations.host
				? this.configuration.hostConfirmed
				: this.configuration.hostNeeded,
			event.confirmations.speakers
				? this.configuration.speakersConfirmed
				: this.configuration.speakersNeeded,
			...occurrenceLabels,
		];

		if (labelsMatch(event.labels, expected)) {
			return emptyResult();
		}

		return normalizedResult(
			replaceEventField("labels", expected, "Project managed lifecycle labels"),
			"event.labels.normalized",
			"labels",
			"Managed meetup labels can be reconciled safely",
		);
	}
}

function labelsMatch(
	actual: readonly string[],
	expected: readonly string[],
): boolean {
	return arraysEqual(actual, expected) || sameMembers(actual, expected);
}

function sameMembers(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length && left.every((label) => right.includes(label))
	);
}

function sortRules(rules: readonly EventRule[]): readonly EventRule[] {
	const byId = new Map<string, EventRule>();
	for (const rule of rules) {
		if (byId.has(rule.id)) {
			throw new EventRuleConfigurationError(
				`Duplicate event rule "${rule.id}"`,
			);
		}
		byId.set(rule.id, rule);
	}

	for (const rule of rules) {
		for (const dependency of rule.dependencies) {
			if (!byId.has(dependency)) {
				throw new EventRuleConfigurationError(
					`Event rule "${rule.id}" has missing dependency "${dependency}"`,
				);
			}
		}
	}

	const permanent = new Set<string>();
	const temporary = new Set<string>();
	const ordered: EventRule[] = [];

	const visit = (rule: EventRule, path: readonly string[]): void => {
		if (temporary.has(rule.id)) {
			throw new EventRuleConfigurationError(
				`Cyclic event rule dependency: ${[...path, rule.id].join(" -> ")}`,
			);
		}
		if (permanent.has(rule.id)) {
			return;
		}

		temporary.add(rule.id);
		for (const dependencyId of rule.dependencies) {
			const dependency = byId.get(dependencyId);
			if (!dependency) {
				throw new EventRuleConfigurationError(
					`Event rule "${rule.id}" has missing dependency "${dependencyId}"`,
				);
			}
			visit(dependency, [...path, rule.id]);
		}
		temporary.delete(rule.id);
		permanent.add(rule.id);
		ordered.push(rule);
	};

	for (const rule of rules) {
		visit(rule, []);
	}
	return Object.freeze(ordered);
}

function emptyResult(): EventRuleResult {
	return { diagnostics: [], patch: EMPTY_EVENT_PATCH };
}

function missing(
	code: string,
	field: string,
	message: string,
): EventRuleResult {
	return {
		diagnostics: [
			diagnostic({
				code,
				severity: "warning",
				category: "incomplete",
				field,
				message,
			}),
		],
		patch: EMPTY_EVENT_PATCH,
	};
}

function invalid(
	code: string,
	field: string,
	message: string,
): EventRuleResult {
	return {
		diagnostics: [
			diagnostic({
				code,
				severity: "error",
				category: "invalid",
				field,
				message,
			}),
		],
		patch: EMPTY_EVENT_PATCH,
	};
}

function normalizeString<P extends "eventTitle" | "date" | "description">(
	current: string,
	normalized: string,
	path: P,
	reason: string,
): EventRuleResult {
	if (current === normalized) {
		return emptyResult();
	}
	return normalizedResult(
		replaceEventField(path, normalized, reason),
		`event.${path}.normalized`,
		path,
		`${path} can be normalized safely`,
	);
}

function normalizedResult(
	operation: EventPatchOperation,
	code: string,
	field: string,
	message: string,
): EventRuleResult {
	return {
		diagnostics: [
			diagnostic({
				code,
				severity: "info",
				category: "normalization",
				field,
				message,
				fixAvailable: true,
			}),
		],
		patch: createEventPatch([operation]),
	};
}

function isValidIsoDate(value: string): boolean {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		return false;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1) {
		return false;
	}
	const monthLengths = [
		31,
		isLeapYear(year) ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	];
	return day <= monthLengths[month - 1];
}

function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function normalizeParticipant(
	participant: ParticipantReference,
): ParticipantReference {
	const displayName = participant.displayName.trim();
	const id = participant.id?.trim();
	return id ? { displayName, id } : { displayName };
}

function participantsEqual(
	left: ParticipantReference,
	right: ParticipantReference,
): boolean {
	return left.displayName === right.displayName && left.id === right.id;
}

function normalizeAgendaEntry(entry: AgendaEntry): AgendaEntry {
	return {
		speakers: entry.speakers.map(normalizeParticipant),
		description: entry.description.trim(),
	};
}

function agendaEqual(
	left: readonly AgendaEntry[],
	right: readonly AgendaEntry[],
): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
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

function isHttpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}
