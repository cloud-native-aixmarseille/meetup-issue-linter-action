import type { EventDiagnostic } from "../../domain/diagnostic.js";
import {
	type EventLifecycleEvaluation,
	evaluateEventLifecycle,
} from "../../domain/lifecycle.js";
import type { EventIdentity, MeetupEvent } from "../../domain/model.js";
import type { EventPatch } from "../../domain/patch.js";
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
import type { EventCommentRepository } from "../ports/event-comment-repository.js";
import type { EventDocumentCodec } from "../ports/event-document-codec.js";
import {
	type EventDocument,
	type EventRepository,
	type EventRepositoryPatch,
	eventRepositoryPatchIsEmpty,
} from "../ports/event-repository.js";

export type ReconcileEventMode = "check" | "fix";

export type ReconcileEventInput = Readonly<{
	identity: EventIdentity;
	mode: ReconcileEventMode;
	/** A caller may supply one already-loaded snapshot to avoid a stale double read. */
	sourceDocument?: EventDocument;
}>;

export type ReconcileEventResult = Readonly<{
	event: MeetupEvent;
	diagnostics: readonly EventDiagnostic[];
	normalizationPatch: EventPatch;
	repositoryPatch: EventRepositoryPatch;
	readiness: EventReadiness;
	lifecycle: EventLifecycleEvaluation;
	persisted: boolean;
	commentUpdated: boolean;
}>;

export type ReconcileEventDependencies = Readonly<{
	repository: EventRepository;
	documentCodec: EventDocumentCodec;
	commentRepository: EventCommentRepository;
	clock: EventClock;
	rules?: readonly EventRule[];
}>;

export class EventNotFoundError extends Error {
	constructor(identity: EventIdentity) {
		super(
			`Meetup event ${identity.repository}#${identity.issueNumber} was not found`,
		);
		this.name = "EventNotFoundError";
	}
}

export class EventConcurrentModificationError extends Error {
	constructor(identity: EventIdentity) {
		super(
			`Meetup event ${identity.repository}#${identity.issueNumber} changed during reconciliation`,
		);
		this.name = "EventConcurrentModificationError";
	}
}

export class ReconcileEvent {
	private readonly ruleEngine: EventRuleEngine;

	constructor(private readonly dependencies: ReconcileEventDependencies) {
		this.ruleEngine = new EventRuleEngine(
			dependencies.rules ?? createDefaultEventRules(),
		);
	}

	async execute(input: ReconcileEventInput): Promise<ReconcileEventResult> {
		const document =
			input.sourceDocument ??
			(await this.dependencies.repository.find(input.identity));
		if (!document) {
			throw new EventNotFoundError(input.identity);
		}
		if (!sameIdentity(document.identity, input.identity)) {
			throw new EventNotFoundError(input.identity);
		}

		const decoded = this.dependencies.documentCodec.decode(document);
		const evaluated = this.ruleEngine.evaluate(decoded.event);
		const diagnostics: EventDiagnostic[] = [
			...decoded.diagnostics,
			...evaluated.diagnostics,
		];

		const readiness = evaluateEventReadiness(evaluated.event, diagnostics);
		const lifecycle = evaluateEventLifecycle({
			event: evaluated.event,
			readiness,
			now: this.dependencies.clock.now(),
		});
		const repositoryPatch = this.dependencies.documentCodec.createPatch(
			document,
			evaluated.event,
		);
		const shouldPersist =
			input.mode === "fix" && !eventRepositoryPatchIsEmpty(repositoryPatch);

		if (shouldPersist) {
			await ensureEventDocumentIsCurrent(
				this.dependencies.repository,
				input.identity,
				document,
			);
			await this.dependencies.repository.applyPatch(
				input.identity,
				repositoryPatch,
			);
		}

		let commentUpdated = false;
		if (input.mode === "fix") {
			const commentResult =
				await this.dependencies.commentRepository.reconcileDiagnostics(
					input.identity,
					readiness.diagnostics,
				);
			commentUpdated = commentResult.changed;
		}

		return {
			event: evaluated.event,
			diagnostics: readiness.diagnostics,
			normalizationPatch: evaluated.patch,
			repositoryPatch,
			readiness,
			lifecycle,
			persisted: shouldPersist,
			commentUpdated,
		};
	}
}

export async function ensureEventDocumentIsCurrent(
	repository: EventRepository,
	identity: EventIdentity,
	expected: EventDocument,
): Promise<void> {
	const current = await repository.find(identity);
	if (!current) {
		throw new EventNotFoundError(identity);
	}
	if (!eventDocumentsEqual(current, expected)) {
		throw new EventConcurrentModificationError(identity);
	}
}

export function eventDocumentsEqual(
	left: EventDocument,
	right: EventDocument,
): boolean {
	const leftLabels = [...left.labels].sort(compareText);
	const rightLabels = [...right.labels].sort(compareText);
	return (
		sameIdentity(left.identity, right.identity) &&
		left.issueState === right.issueState &&
		left.issueTitle === right.issueTitle &&
		left.body === right.body &&
		leftLabels.length === rightLabels.length &&
		leftLabels.every((label, index) => label === rightLabels[index])
	);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sameIdentity(left: EventIdentity, right: EventIdentity): boolean {
	return (
		left.issueNumber === right.issueNumber &&
		left.repository.toLowerCase() === right.repository.toLowerCase()
	);
}
