import {
	type EventClock,
	type EventDocument,
	type EventDocumentCodec,
	type EventIdentity,
	type MeetupEvent,
	EventNotFoundError,
	type EventRepository,
	EventRepositoryPatches,
	ReconcileEvent,
} from "@meetup-automation/event";
import {
	type FeedbackEventGateway,
	type FeedbackLinkGateway,
	FeedbackPolicy,
} from "@meetup-automation/publication";
import type { PublicDiagnostic } from "../result/result-envelope.js";
import type { ManageMeetupEvent } from "./manage-meetup-event.js";

interface FeedbackDependencies {
	readonly eventRepository: EventRepository;
	readonly documentCodec: EventDocumentCodec;
	readonly manageEvent: Pick<ManageMeetupEvent, "execute">;
	readonly clock: EventClock;
	readonly links: FeedbackLinkGateway;
	readonly events: FeedbackEventGateway;
}

export type ManageMeetupFeedbackResult = Readonly<{
	skipped: boolean;
	persisted: boolean;
	feedbackUrl?: string;
	linkUpdated: boolean;
	diagnostics: readonly PublicDiagnostic[];
}>;

export class ManageMeetupFeedback {
	constructor(private readonly dependencies: FeedbackDependencies) {}

	async execute(input: {
		identity: EventIdentity;
		mode: "check" | "fix";
	}): Promise<ManageMeetupFeedbackResult> {
		const source = await this.dependencies.eventRepository.find(input.identity);
		if (!source) throw new EventNotFoundError(input.identity);
		const evaluation = await this.dependencies.manageEvent.execute({
			...input,
			mode: "check",
			sourceDocument: source,
		});
		if (evaluation.skipped)
			return this.skipped("unrelated", "This issue is not a meetup");
		const event = evaluation.event;
		if (
			event.issueState === "closed" ||
			event.occurrenceStatus === "cancelled" ||
			event.occurrenceStatus === "postponed"
		)
			return this.skipped(
				"inactive",
				"Feedback automation is inactive for this event",
			);
		if (
			!FeedbackPolicy.validDate(event.date) ||
			ManageMeetupFeedback.invalid(evaluation.diagnostics)
		)
			return this.skipped(
				"prerequisites",
				"Resolve the event date and feedback link before updating feedback",
			);
		const feedbackUrl = event.publicationLinks.feedback;
		if (!feedbackUrl) return this.createFeedback(source, event, input.mode);
		return this.reconcile(
			source,
			event,
			FeedbackPolicy.pollUrl(feedbackUrl),
			input.mode,
		);
	}

	private async createFeedback(
		source: EventDocument,
		event: MeetupEvent,
		mode: "check" | "fix",
	): Promise<ManageMeetupFeedbackResult> {
		const name = event.eventTitle.trim().slice(0, 100);
		if (!name)
			return this.skipped(
				"prerequisites",
				"Set an event title before creating feedback",
			);
		if (mode === "check")
			return this.skipped(
				"creation-pending",
				"An OpenFeedback event will be created in fix mode; configure its talks and speakers in OpenFeedback",
			);
		await this.ensureCurrent(source);
		const { repository, issueNumber } = source.identity;
		const url = await this.dependencies.events.ensureEvent({
			key: `${repository.toLowerCase()}#${issueNumber}`,
			name,
			scheduleUrl: `https://github.com/${repository}/issues/${issueNumber}`,
		});
		return this.reconcile(source, event, FeedbackPolicy.pollUrl(url), mode);
	}

	private async reconcile(
		source: EventDocument,
		event: MeetupEvent,
		url: string,
		mode: "check" | "fix",
	): Promise<ManageMeetupFeedbackResult> {
		if (mode === "check")
			return {
				skipped: false,
				persisted: false,
				feedbackUrl: url,
				linkUpdated: false,
				diagnostics: [],
			};
		await this.ensureCurrent(source);
		const { persisted, current } = await this.persist(source, url);
		const diagnostics: PublicDiagnostic[] = [];
		let linkUpdated = false;
		if (
			FeedbackPolicy.isEventDay(
				event.date,
				this.dependencies.clock.now(),
				event.timeZone,
			)
		) {
			if (await this.isOnlyEventOnDate(source, event.date)) {
				await this.ensureCurrent(current);
				linkUpdated = await this.dependencies.links.updateTarget(url);
			} else
				diagnostics.push({
					code: "publication.feedback.ambiguous-date",
					severity: "warning",
					message:
						"Several active meetups share this date; update the shared feedback link manually",
				});
		}
		return {
			skipped: false,
			persisted,
			feedbackUrl: url,
			linkUpdated,
			diagnostics,
		};
	}

	private static invalid(diagnostics: readonly PublicDiagnostic[]): boolean {
		const fields = /date|feedback/i;
		return diagnostics.some(
			(item) =>
				item.severity === "error" &&
				(item.code.startsWith("event.document.") ||
					fields.test(item.field ?? "")),
		);
	}

	private async persist(
		source: EventDocument,
		feedbackUrl: string,
	): Promise<{ persisted: boolean; current: EventDocument }> {
		const original = this.dependencies.documentCodec.decode(source).event;
		if (original.publicationLinks.feedback === feedbackUrl)
			return { persisted: false, current: source };
		const patch = this.dependencies.documentCodec.createPatch(source, {
			...original,
			publicationLinks: { ...original.publicationLinks, feedback: feedbackUrl },
		});
		if (EventRepositoryPatches.eventRepositoryPatchIsEmpty(patch))
			return { persisted: false, current: source };
		await this.ensureCurrent(source);
		await this.dependencies.eventRepository.applyPatch(source.identity, patch);
		return { persisted: true, current: { ...source, ...patch } };
	}

	private async isOnlyEventOnDate(
		source: EventDocument,
		date: string,
	): Promise<boolean> {
		let cursor: string | undefined;
		const visited = new Set<string>();
		do {
			const page = await this.dependencies.eventRepository.listPage({
				repository: source.identity.repository,
				label: "meetup",
				cursor,
			});
			for (const document of page.items) {
				if (document.identity.issueNumber === source.identity.issueNumber)
					continue;
				const { event } = this.dependencies.documentCodec.decode(document);
				if (
					event.date === date &&
					event.issueState === "open" &&
					event.occurrenceStatus !== "cancelled" &&
					event.occurrenceStatus !== "postponed"
				)
					return false;
			}
			cursor = page.nextCursor;
			if (cursor && visited.has(cursor))
				throw new Error("Feedback event pagination did not advance");
			if (cursor) visited.add(cursor);
		} while (cursor);
		return true;
	}

	private ensureCurrent(source: EventDocument) {
		return ReconcileEvent.ensureEventDocumentIsCurrent(
			this.dependencies.eventRepository,
			source.identity,
			source,
		);
	}

	private skipped(code: string, message: string): ManageMeetupFeedbackResult {
		return {
			skipped: true,
			persisted: false,
			linkUpdated: false,
			diagnostics: [
				{
					code: `publication.feedback.${code}`,
					severity: "info",
					field: "publicationLinks.feedback",
					message,
				},
			],
		};
	}
}
