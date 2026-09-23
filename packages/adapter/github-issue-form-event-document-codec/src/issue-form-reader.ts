import {
	type EventDiagnostic,
	EventDiagnostics,
	type EventDocument,
	type EventDocumentDecodeResult,
	type LegacyMeetupIssueBodyDto,
	type MeetupEvent,
	MeetupEventMigration,
	MeetupEventOperations,
} from "@meetup-automation/event";
import { EventReferenceMetadata } from "./event-reference-metadata.js";
import {
	type GitHubIssueFormEventDocumentCodecOptions,
	HEADINGS,
	type Section,
} from "./github-issue-form-event-document-codec-contracts.js";
import { IssueFormChecklists } from "./issue-form-checklists.js";
import { IssueFormSections } from "./issue-form-sections.js";
import { ManagedIssueMarkers } from "./managed-issue-markers.js";
import { ParticipantLinks } from "./participant-links.js";

type Sections = ReadonlyMap<string, readonly Section[]>;

export class IssueFormReader {
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
		const sections = IssueFormSections.parseSections(document.body);
		const schema = ManagedIssueMarkers.readSchema(document.body, diagnostics);
		const parsedBody = this.readBody(sections, diagnostics);
		const operations = this.readOperations(sections, diagnostics);
		const migrated = MeetupEventMigration.migrateMeetupEventDto({
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
		const event: MeetupEvent = {
			...migrated.event,
			...operations,
			confirmations: {
				host: document.labels.includes(this.hostConfirmationLabel),
				speakers: document.labels.includes(this.speakersConfirmationLabel),
			},
		};
		const referenced = this.restoreReferences(
			event,
			document.body,
			schema,
			diagnostics,
		);
		return {
			event: this.restoreLinks(
				referenced,
				sections,
				document.identity.repository,
			),
			diagnostics: Object.freeze(diagnostics),
		};
	}
	private readBody(
		sections: Sections,
		diagnostics: EventDiagnostic[],
	): LegacyMeetupIssueBodyDto {
		const read = (heading: string, required = false) =>
			IssueFormSections.readSection(sections, heading, required, diagnostics);
		return {
			event_title: read(HEADINGS.eventTitle, true),
			event_date: read(HEADINGS.date, true),
			hoster: [read(HEADINGS.host, true)].filter(Boolean),
			event_description: read(HEADINGS.description, true),
			agenda: read(HEADINGS.agenda, true),
			meetup_link: read(HEADINGS.meetupLink),
			cncf_link: read(HEADINGS.communityLink),
			drive_link: read(HEADINGS.assetsLink),
			openfeedback_link: read(HEADINGS.feedbackLink),
			event_status: read(HEADINGS.occurrenceStatus),
		};
	}
	private readOperations(
		sections: Sections,
		diagnostics: EventDiagnostic[],
	): Pick<
		MeetupEvent,
		"logistics" | "operationalChecklists" | "followUpComplete"
	> {
		const read = (heading: string) =>
			IssueFormChecklists.toOperationalChecklist(
				IssueFormChecklists.readCheckboxes(sections, heading, diagnostics),
			);
		const slidesAndContent = read(HEADINGS.slides);
		const communication = read(HEADINGS.communication);
		const diagnosticOffset = diagnostics.length;
		const postEvent = read(HEADINGS.postEvent);
		const followUpComplete =
			diagnostics.length === diagnosticOffset &&
			MeetupEventOperations.postEventChecklistIsComplete(postEvent);
		return {
			operationalChecklists: { slidesAndContent, communication, postEvent },
			followUpComplete,
			logistics: {
				aperitif: IssueFormChecklists.readLogisticsIntent(
					sections,
					HEADINGS.aperitif,
					diagnostics,
				),
				postEventVenue: IssueFormChecklists.readLogisticsIntent(
					sections,
					HEADINGS.restaurant,
					diagnostics,
				),
			},
		};
	}
	private restoreReferences(
		event: MeetupEvent,
		body: string,
		schema: 0 | 1,
		diagnostics: EventDiagnostic[],
	): MeetupEvent {
		const metadata = EventReferenceMetadata.readReferenceMetadata(
			body,
			diagnostics,
		);
		if (metadata)
			return EventReferenceMetadata.applyReferenceMetadata(
				event,
				metadata,
				diagnostics,
			);
		if (schema === 1)
			diagnostics.push(
				EventDiagnostics.diagnostic({
					code: "event.document.reference-metadata.missing",
					severity: "warning",
					category: "migration",
					message: "Stable reference metadata is missing",
					fixAvailable: true,
				}),
			);
		return event;
	}
	private restoreLinks(
		event: MeetupEvent,
		sections: Sections,
		repository: string,
	): MeetupEvent {
		// Locations are presentation data. Identity comes from name-bound metadata.
		const hostSources = ParticipantLinks.readSourceLinks(
			sections.get(HEADINGS.host)?.[0]?.value ?? "",
			repository,
		);
		const speakerSources = ParticipantLinks.readSourceLinks(
			sections.get(HEADINGS.agenda)?.[0]?.value ?? "",
			repository,
		);
		return {
			...event,
			host: event.host
				? ParticipantLinks.restoreSourceLocation(event.host, hostSources)
				: undefined,
			agenda: event.agenda.map((entry) => ({
				...entry,
				speakers: entry.speakers.map((speaker) =>
					ParticipantLinks.restoreSourceLocation(speaker, speakerSources),
				),
			})),
		};
	}
}
