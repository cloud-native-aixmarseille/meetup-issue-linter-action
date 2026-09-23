import type {
	EventDocument,
	EventRepositoryPatch,
	MeetupEvent,
	ParticipantReference,
} from "@meetup-automation/event";
import { EventReferenceMetadata } from "./event-reference-metadata.js";
import {
	type GitHubIssueFormEventDocumentCodecOptions,
	HEADINGS,
} from "./github-issue-form-event-document-codec-contracts.js";
import { IssueFormChecklists } from "./issue-form-checklists.js";
import { IssueFormSections } from "./issue-form-sections.js";
import { ManagedIssueMarkers } from "./managed-issue-markers.js";
import { ParticipantLinks } from "./participant-links.js";

export class IssueFormWriter {
	private readonly repositoryRef: string;
	constructor(options: GitHubIssueFormEventDocumentCodecOptions = {}) {
		this.repositoryRef = options.repositoryRef ?? "main";
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
		if (document.issueTitle !== event.issueTitle)
			patch.issueTitle = event.issueTitle;
		if (!IssueFormWriter.arraysEqual(document.labels, event.labels))
			patch.labels = Object.freeze([...event.labels]);
		const fields = this.renderFields(document, event);
		const checklists = this.renderOperations(fields, event);
		const body = ManagedIssueMarkers.upsertManagedMarkers(
			checklists,
			EventReferenceMetadata.referenceMetadata(event),
		);
		if (body !== document.body) patch.body = body;
		return Object.freeze(patch);
	}
	private renderFields(document: EventDocument, event: MeetupEvent): string {
		const render = (participant: ParticipantReference) =>
			this.renderParticipant(participant, document.identity.repository);
		const fields = [
			[HEADINGS.eventTitle, event.eventTitle],
			[HEADINGS.date, event.date],
			[HEADINGS.host, event.host ? render(event.host) : ""],
			[HEADINGS.description, event.description],
			[HEADINGS.agenda, ParticipantLinks.renderAgenda(event, render)],
			[HEADINGS.meetupLink, event.publicationLinks.meetup ?? ""],
			[HEADINGS.communityLink, event.publicationLinks.community ?? ""],
			[HEADINGS.assetsLink, event.publicationLinks.assets ?? ""],
		] as const;
		let body = document.body;
		for (const [heading, value] of fields)
			body = IssueFormSections.replaceOrAppendSection(body, heading, value);
		if (event.publicationLinks.feedback)
			body = IssueFormSections.replaceOrAppendSection(
				body,
				HEADINGS.feedbackLink,
				event.publicationLinks.feedback,
			);
		return IssueFormSections.removeSection(body, HEADINGS.occurrenceStatus);
	}
	private renderOperations(source: string, event: MeetupEvent): string {
		let body = source;
		for (const [heading, items] of [
			[HEADINGS.slides, event.operationalChecklists.slidesAndContent],
			[HEADINGS.communication, event.operationalChecklists.communication],
		] as const)
			body = IssueFormChecklists.replaceOrAppendOperationalChecklist(
				body,
				heading,
				IssueFormChecklists.renderOperationalChecklist(items),
			);
		body = IssueFormChecklists.replaceOrAppendLogisticsIntent(
			body,
			HEADINGS.aperitif,
			event.logistics.aperitif,
		);
		body = IssueFormChecklists.replaceOrAppendLogisticsIntent(
			body,
			HEADINGS.restaurant,
			event.logistics.postEventVenue,
		);
		return IssueFormChecklists.replaceOrAppendOperationalChecklist(
			body,
			HEADINGS.postEvent,
			IssueFormChecklists.renderOperationalChecklist(
				event.operationalChecklists.postEvent,
			),
		);
	}
	private renderParticipant(
		participant: ParticipantReference,
		repository: string,
	): string {
		if (!participant.id || !participant.source) return participant.displayName;
		const path = participant.source.path
			.split("/")
			.map(ParticipantLinks.encodeUrlSegment)
			.join("/");
		const ref = ParticipantLinks.encodeUrlSegment(this.repositoryRef);
		const url = `https://github.com/${repository}/blob/${ref}/${path}#L${participant.source.line}`;
		return `[${participant.displayName}](${url})`;
	}
	private static arraysEqual(
		left: readonly string[],
		right: readonly string[],
	): boolean {
		return (
			left.length === right.length &&
			left.every((value, index) => value === right[index])
		);
	}
}
