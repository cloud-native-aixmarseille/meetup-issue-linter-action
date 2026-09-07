import type { EventDiagnostic } from "../../domain/diagnostic.js";
import {
	type EventLifecycleEvaluation,
	evaluateEventLifecycle,
} from "../../domain/lifecycle.js";
import type { EventIdentity, MeetupEvent } from "../../domain/model.js";
import {
	type EventReadiness,
	evaluateEventReadiness,
} from "../../domain/readiness.js";
import {
	createDefaultEventRules,
	type EventRule,
	EventRuleEngine,
} from "../../domain/rule.js";
import type { EventClock } from "../ports/event-clock.js";
import type { EventDocumentCodec } from "../ports/event-document-codec.js";
import type { EventRepository } from "../ports/event-repository.js";

export type ListActiveEventsInput = Readonly<{
	repository: string;
	label?: string;
	includeClosed?: boolean;
	pageSize?: number;
}>;

export type ActiveEvent = Readonly<{
	identity: EventIdentity;
	event: MeetupEvent;
	readiness: EventReadiness;
	lifecycle: EventLifecycleEvaluation;
}>;

export type ListActiveEventsResult = Readonly<{
	events: readonly ActiveEvent[];
	diagnostics: readonly EventDiagnostic[];
}>;

export type ListActiveEventsDependencies = Readonly<{
	repository: EventRepository;
	documentCodec: EventDocumentCodec;
	clock: EventClock;
	rules?: readonly EventRule[];
}>;

export class EventPaginationError extends Error {
	constructor(cursor: string) {
		super(`Event repository repeated pagination cursor "${cursor}"`);
		this.name = "EventPaginationError";
	}
}

export class ListActiveEvents {
	private readonly ruleEngine: EventRuleEngine;

	constructor(private readonly dependencies: ListActiveEventsDependencies) {
		this.ruleEngine = new EventRuleEngine(
			dependencies.rules ?? createDefaultEventRules(),
		);
	}

	async execute(input: ListActiveEventsInput): Promise<ListActiveEventsResult> {
		const activeEvents: ActiveEvent[] = [];
		const allDiagnostics: EventDiagnostic[] = [];
		const seenCursors = new Set<string>();
		const seenEvents = new Set<string>();
		const now = this.dependencies.clock.now();
		let cursor: string | undefined;

		do {
			const page = await this.dependencies.repository.listPage({
				...input,
				cursor,
			});

			for (const document of page.items) {
				const identityKey = `${document.identity.repository}#${document.identity.issueNumber}`;
				if (seenEvents.has(identityKey)) {
					continue;
				}
				seenEvents.add(identityKey);

				const decoded = this.dependencies.documentCodec.decode(document);
				const evaluated = this.ruleEngine.evaluate(decoded.event);
				const eventDiagnostics: EventDiagnostic[] = [
					...decoded.diagnostics,
					...evaluated.diagnostics,
				];
				const readiness = evaluateEventReadiness(
					evaluated.event,
					eventDiagnostics,
				);
				const lifecycle = evaluateEventLifecycle({
					event: evaluated.event,
					readiness,
					now,
				});
				allDiagnostics.push(...readiness.diagnostics);

				if (
					lifecycle.state !== "cancelled" &&
					lifecycle.state !== "follow-up-complete"
				) {
					activeEvents.push({
						identity: { ...document.identity },
						event: evaluated.event,
						readiness,
						lifecycle,
					});
				}
			}

			cursor = page.nextCursor;
			if (cursor) {
				if (seenCursors.has(cursor)) {
					throw new EventPaginationError(cursor);
				}
				seenCursors.add(cursor);
			}
		} while (cursor);

		return {
			events: Object.freeze(activeEvents),
			diagnostics: Object.freeze(allDiagnostics),
		};
	}
}
