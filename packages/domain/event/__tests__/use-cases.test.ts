import { describe, expect, it, vi } from "vitest";
import {
	type EventClock,
	type EventCommentRepository,
	EventConcurrentModificationError,
	type EventDocument,
	type EventDocumentCodec,
	EventNotFoundError,
	EventPaginationError,
	type EventRepository,
	EXPECTED_POST_EVENT_TASK_NAMES,
	ListActiveEvents,
	type MeetupEvent,
	ReconcileEvent,
} from "../src/index.js";
import { createTestEvent } from "./test-event.js";

const identity = {
	repository: "cloud-native-aixmarseille/meetups",
	issueNumber: 42,
} as const;

const document: EventDocument = {
	identity,
	issueState: "open",
	issueTitle: "Wrong title",
	labels: ["community"],
	body: "legacy document",
};

function createClock(): EventClock {
	return { now: () => "2026-09-04T10:00:00+02:00" };
}

function createCodec(
	events: ReadonlyMap<number, MeetupEvent>,
): EventDocumentCodec {
	return {
		decode: (source) => {
			const event = events.get(source.identity.issueNumber);
			if (!event) {
				throw new Error("Fixture event missing");
			}
			return { event, diagnostics: [] };
		},
		createPatch: (source, event) => ({
			...(source.issueTitle === event.issueTitle
				? {}
				: { issueTitle: event.issueTitle }),
			...(JSON.stringify(source.labels) === JSON.stringify(event.labels)
				? {}
				: { labels: event.labels }),
		}),
	};
}

describe("ReconcileEvent", () => {
	it("checks and proposes immutable patches without writing", async () => {
		const event = createTestEvent({
			identity,
			issueTitle: document.issueTitle,
			labels: document.labels,
			eventTitle: " Cloud Native Evening ",
			occurrenceStatus: undefined,
		});
		const repository: EventRepository = {
			find: vi.fn().mockResolvedValue(document),
			applyPatch: vi.fn(),
			listPage: vi.fn(),
		};
		const comments: EventCommentRepository = {
			reconcileDiagnostics: vi.fn(),
		};
		const useCase = new ReconcileEvent({
			repository,
			documentCodec: createCodec(new Map([[42, event]])),
			commentRepository: comments,
			clock: createClock(),
		});

		const result = await useCase.execute({ identity, mode: "check" });

		expect(result.event.eventTitle).toBe("Cloud Native Evening");
		expect(result.normalizationPatch.operations.length).toBeGreaterThan(0);
		expect(result.repositoryPatch.issueTitle).toBe(
			"[Meetup] - 2026-09-30 - Cloud Native Evening",
		);
		expect(result.persisted).toBe(false);
		expect(repository.applyPatch).not.toHaveBeenCalled();
		expect(comments.reconcileDiagnostics).not.toHaveBeenCalled();
	});

	it("persists a minimal projection and reconciles one managed comment in fix mode", async () => {
		const event = createTestEvent({
			identity,
			issueTitle: document.issueTitle,
			labels: document.labels,
		});
		const repository: EventRepository = {
			find: vi.fn().mockResolvedValue(document),
			applyPatch: vi.fn().mockResolvedValue(undefined),
			listPage: vi.fn(),
		};
		const comments: EventCommentRepository = {
			reconcileDiagnostics: vi.fn().mockResolvedValue({ changed: true }),
		};
		const useCase = new ReconcileEvent({
			repository,
			documentCodec: createCodec(new Map([[42, event]])),
			commentRepository: comments,
			clock: createClock(),
		});

		const result = await useCase.execute({ identity, mode: "fix" });

		expect(repository.applyPatch).toHaveBeenCalledOnce();
		expect(repository.applyPatch).toHaveBeenCalledWith(
			identity,
			expect.objectContaining({
				issueTitle: "[Meetup] - 2026-09-30 - Cloud Native Evening",
			}),
		);
		expect(comments.reconcileDiagnostics).toHaveBeenCalledOnce();
		expect(result.persisted).toBe(true);
		expect(result.commentUpdated).toBe(true);
	});

	it("does not write an empty repository patch", async () => {
		const event = createTestEvent({ identity });
		const matchingDocument: EventDocument = {
			...document,
			issueTitle: event.issueTitle,
			labels: event.labels,
		};
		const repository: EventRepository = {
			find: vi.fn().mockResolvedValue(matchingDocument),
			applyPatch: vi.fn(),
			listPage: vi.fn(),
		};
		const comments: EventCommentRepository = {
			reconcileDiagnostics: vi.fn().mockResolvedValue({ changed: false }),
		};
		const useCase = new ReconcileEvent({
			repository,
			documentCodec: createCodec(new Map([[42, event]])),
			commentRepository: comments,
			clock: createClock(),
		});

		const result = await useCase.execute({ identity, mode: "fix" });

		expect(result.persisted).toBe(false);
		expect(repository.applyPatch).not.toHaveBeenCalled();
	});

	it("fails closed if the issue changes before a patch is persisted", async () => {
		const event = createTestEvent({
			identity,
			issueTitle: document.issueTitle,
			labels: document.labels,
		});
		const repository: EventRepository = {
			find: vi
				.fn()
				.mockResolvedValueOnce(document)
				.mockResolvedValueOnce({ ...document, body: "concurrent edit" }),
			applyPatch: vi.fn(),
			listPage: vi.fn(),
		};
		const useCase = new ReconcileEvent({
			repository,
			documentCodec: createCodec(new Map([[42, event]])),
			commentRepository: { reconcileDiagnostics: vi.fn() },
			clock: createClock(),
		});

		await expect(useCase.execute({ identity, mode: "fix" })).rejects.toEqual(
			new EventConcurrentModificationError(identity),
		);
		expect(repository.applyPatch).not.toHaveBeenCalled();
	});

	it("fails explicitly when the event does not exist", async () => {
		const repository: EventRepository = {
			find: vi.fn().mockResolvedValue(null),
			applyPatch: vi.fn(),
			listPage: vi.fn(),
		};
		const useCase = new ReconcileEvent({
			repository,
			documentCodec: createCodec(new Map()),
			commentRepository: { reconcileDiagnostics: vi.fn() },
			clock: createClock(),
		});

		await expect(useCase.execute({ identity, mode: "check" })).rejects.toEqual(
			new EventNotFoundError(identity),
		);
	});
});

describe("ListActiveEvents", () => {
	it("paginates, deduplicates, and excludes terminal lifecycle states", async () => {
		const activeDocument = {
			...document,
			identity: { ...identity, issueNumber: 1 },
		};
		const cancelledDocument = {
			...document,
			identity: { ...identity, issueNumber: 2 },
		};
		const completedDocument = {
			...document,
			identity: { ...identity, issueNumber: 3 },
		};
		const listPage = vi
			.fn()
			.mockResolvedValueOnce({
				items: [activeDocument, cancelledDocument],
				nextCursor: "page-2",
			})
			.mockResolvedValueOnce({
				items: [activeDocument, completedDocument],
			});
		const repository: EventRepository = {
			find: vi.fn(),
			applyPatch: vi.fn(),
			listPage,
		};
		const events = new Map<number, MeetupEvent>([
			[1, createTestEvent({ identity: activeDocument.identity })],
			[
				2,
				createTestEvent({
					identity: cancelledDocument.identity,
					occurrenceStatus: "cancelled",
				}),
			],
			[
				3,
				createTestEvent({
					identity: completedDocument.identity,
					occurrenceStatus: "held",
					operationalChecklists: {
						slidesAndContent: [],
						communication: [],
						postEvent: EXPECTED_POST_EVENT_TASK_NAMES.map((name) => ({
							name,
							completed: true,
						})),
					},
					followUpComplete: true,
				}),
			],
		]);
		const useCase = new ListActiveEvents({
			repository,
			documentCodec: createCodec(events),
			clock: createClock(),
		});

		const result = await useCase.execute({
			repository: identity.repository,
			label: "meetup",
		});

		expect(listPage).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ cursor: "page-2" }),
		);
		expect(result.events.map((entry) => entry.identity.issueNumber)).toEqual([
			1,
		]);
	});

	it("rejects a repeated pagination cursor", async () => {
		const repository: EventRepository = {
			find: vi.fn(),
			applyPatch: vi.fn(),
			listPage: vi
				.fn()
				.mockResolvedValue({ items: [], nextCursor: "same-page" }),
		};
		const useCase = new ListActiveEvents({
			repository,
			documentCodec: createCodec(new Map()),
			clock: createClock(),
		});

		await expect(
			useCase.execute({ repository: identity.repository }),
		).rejects.toEqual(new EventPaginationError("same-page"));
	});
});
