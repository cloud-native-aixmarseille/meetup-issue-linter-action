import { type EventDiagnostic, EventDiagnostics } from "./diagnostic.js";
import type {
	EventDtoMigrationResult,
	LegacyMeetupEventDto,
	MeetupEventDto,
} from "./dto-contracts.js";
import { EventOccurrenceParser } from "./event-occurrence-parser.js";
import { LegacyEventFields } from "./legacy-event-fields.js";
import {
	EVENT_SCHEMA_VERSION,
	type MeetupEvent,
	MeetupEventOperations,
	type ParticipantReference,
} from "./model.js";
import { ParticipantReferenceParser } from "./participant-reference-parser.js";

export class MeetupEventMigration {
	static parseParticipantReference(value: string): ParticipantReference {
		return ParticipantReferenceParser.parseParticipantReference(value);
	}
	static migrateMeetupEventDto(dto: MeetupEventDto): EventDtoMigrationResult {
		if (dto.schemaVersion === EVENT_SCHEMA_VERSION) {
			return {
				event: MeetupEventOperations.cloneMeetupEvent(dto),
				diagnostics: [],
			};
		}

		return MeetupEventMigration.migrateLegacyDto(dto);
	}

	static migrateLegacyDto(dto: LegacyMeetupEventDto): EventDtoMigrationResult {
		const diagnostics: EventDiagnostic[] = [];
		const body = dto.parsedBody;

		const { eventTitle, date, description, host, agenda, occurrenceStatus } =
			MeetupEventMigration.legacyFields(dto, diagnostics);

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
			publicationLinks: MeetupEventMigration.publicationLinks(
				body,
				diagnostics,
			),
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
			EventDiagnostics.diagnostic({
				code: "event.document.legacy-schema",
				severity: "info",
				category: "migration",
				message: "The legacy event document was migrated to schema version 1",
				fixAvailable: true,
			}),
		);

		return { event, diagnostics };
	}

	private static publicationLinks(
		body: LegacyMeetupEventDto["parsedBody"],
		diagnostics: EventDiagnostic[],
	) {
		return {
			meetup: LegacyEventFields.readOptionalString(
				body.meetup_link,
				"meetup_link",
				diagnostics,
			),
			community: LegacyEventFields.readOptionalString(
				body.cncf_link,
				"cncf_link",
				diagnostics,
			),
			feedback: LegacyEventFields.readOptionalString(
				body.openfeedback_link,
				"openfeedback_link",
				diagnostics,
			),
			assets: LegacyEventFields.readOptionalString(
				body.drive_link,
				"drive_link",
				diagnostics,
			),
		};
	}
	private static legacyFields(
		dto: LegacyMeetupEventDto,
		diagnostics: EventDiagnostic[],
	) {
		const body = dto.parsedBody;
		const eventTitle = LegacyEventFields.readString(
			body.event_title,
			"event_title",
			diagnostics,
		);
		const date = LegacyEventFields.readString(
			body.event_date,
			"event_date",
			diagnostics,
		);
		const description = LegacyEventFields.readString(
			body.event_description,
			"event_description",
			diagnostics,
		);
		const host = LegacyEventFields.readLegacyHost(body.hoster, diagnostics);
		const agenda = LegacyEventFields.readLegacyAgenda(body.agenda, diagnostics);
		const occurrenceStatus = EventOccurrenceParser.readOccurrenceStatus(
			dto.labels ?? [],
			dto.issueState ?? "open",
			body.event_status,
			diagnostics,
		);
		return { eventTitle, date, description, host, agenda, occurrenceStatus };
	}
}
