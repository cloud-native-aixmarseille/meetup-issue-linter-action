import type { EventDocument, MeetupEvent } from "@meetup-automation/event";
import type {
	FeedbackEventGateway,
	FeedbackLinkGateway,
} from "@meetup-automation/publication";
import { describe, expect, it, vi } from "vitest";
import {
	catalog,
	config,
	createEventDependencies,
	event,
	identity,
	sourceDocument,
} from "../../testing/meetup-journey.fixtures.js";
import { ManageMeetupEvent } from "./manage-meetup-event.js";
import { ManageMeetupFeedback } from "./manage-meetup-feedback.js";

const feedbackUrl = "https://openfeedback.io/example-poll";
function journey(
	overrides: Partial<MeetupEvent> = {},
	now = "2026-09-30T10:00:00Z",
) {
	const deps = createEventDependencies();
	let current: EventDocument = sourceDocument;
	let currentEvent: MeetupEvent = {
		...event,
		publicationLinks: { ...event.publicationLinks, feedback: feedbackUrl },
		...overrides,
	};
	let pendingEvent = currentEvent;
	vi.mocked(deps.repository.find).mockImplementation(async () => current);
	vi.mocked(deps.repository.applyPatch).mockImplementation(async (_, patch) => {
		current = { ...current, ...patch };
		currentEvent = pendingEvent;
	});
	vi.mocked(deps.repository.listPage).mockResolvedValue({ items: [] });
	vi.mocked(deps.documentCodec.decode).mockImplementation(() => ({
		event: currentEvent,
		diagnostics: [],
	}));
	vi.mocked(deps.documentCodec.createPatch).mockImplementation((_, updated) => {
		pendingEvent = updated;
		return { body: "normalized feedback URL" };
	});
	const events = {
		ensureEvent: vi
			.fn<FeedbackEventGateway["ensureEvent"]>()
			.mockResolvedValue(feedbackUrl),
	};
	const links = {
		updateTarget: vi
			.fn<FeedbackLinkGateway["updateTarget"]>()
			.mockResolvedValue(true),
	};
	const useCase = new ManageMeetupFeedback({
		eventRepository: deps.repository,
		documentCodec: deps.documentCodec,
		clock: { now: () => now },
		links,
		events,
		manageEvent: new ManageMeetupEvent({
			config,
			eventDependencies: deps,
			referentialRepository: { load: async () => catalog },
		}),
	});
	return { deps, events, links, useCase };
}

describe("meetup feedback journey", () => {
	it("updates the shared link to the existing poll on the event day", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey();

		// Act
		const result = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(result).toMatchObject({
			persisted: false,
			linkUpdated: true,
			feedbackUrl,
		});
		expect(links.updateTarget).toHaveBeenCalledWith(feedbackUrl);
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(events.ensureEvent).not.toHaveBeenCalled();
		expect(deps.commentRepository.reconcileDiagnostics).not.toHaveBeenCalled();
	});

	it("validates the poll URL without remote or issue writes in check mode", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey();

		// Act
		const result = await useCase.execute({ identity, mode: "check" });

		// Assert
		expect(result.persisted).toBe(false);
		expect(links.updateTarget).not.toHaveBeenCalled();
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(events.ensureEvent).not.toHaveBeenCalled();
	});

	it.each(["2026-09-29T10:00:00Z", "2026-10-01T10:00:00Z"])(
		"leaves the shared link unchanged outside the event day: %s",
		async (now) => {
			// Arrange
			const { links, useCase } = journey({}, now);

			// Act
			const result = await useCase.execute({ identity, mode: "fix" });

			// Assert
			expect(result.feedbackUrl).toBe(feedbackUrl);
			expect(links.updateTarget).not.toHaveBeenCalled();
		},
	);

	it("updates the link even when talks are incomplete", async () => {
		// Arrange
		const { links, useCase } = journey({ agenda: [] });

		// Act
		const result = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(result.feedbackUrl).toBe(feedbackUrl);
		expect(links.updateTarget).toHaveBeenCalledWith(feedbackUrl);
	});

	it.each([
		{
			occurrenceStatus: "cancelled" as const,
			labels: [...event.labels, "event:cancelled"],
		},
		{
			occurrenceStatus: "postponed" as const,
			labels: [...event.labels, "event:postponed"],
		},
		{ issueState: "closed" as const },
		{ date: "invalid" },
	])(
		"does not update feedback for inactive or invalid events: %j",
		async (overrides) => {
			// Arrange
			const { events, links, useCase } = journey({
				...overrides,
				publicationLinks: event.publicationLinks,
			});

			// Act
			const result = await useCase.execute({ identity, mode: "fix" });

			// Assert
			expect(result.skipped).toBe(true);
			expect(events.ensureEvent).not.toHaveBeenCalled();
			expect(links.updateTarget).not.toHaveBeenCalled();
		},
	);

	it("leaves the shared link unchanged for conflicting active events found on a later page", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey();
		vi.mocked(deps.repository.listPage)
			.mockResolvedValueOnce({ items: [], nextCursor: "2" })
			.mockResolvedValueOnce({
				items: [
					{ ...sourceDocument, identity: { ...identity, issueNumber: 99 } },
				],
			});

		// Act
		const result = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({ code: "publication.feedback.ambiguous-date" }),
		);
		expect(links.updateTarget).not.toHaveBeenCalled();
		expect(events.ensureEvent).not.toHaveBeenCalled();
	});

	it("preserves an issue edit made while checking for concurrent meetups", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey();
		vi.mocked(deps.repository.listPage).mockImplementation(async () => {
			vi.mocked(deps.repository.find).mockResolvedValue({
				...sourceDocument,
				body: "human edit",
			});
			return { items: [] };
		});

		// Act
		const operation = useCase.execute({ identity, mode: "fix" });

		// Assert
		await expect(operation).rejects.toMatchObject({
			name: "EventConcurrentModificationError",
		});
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(events.ensureEvent).not.toHaveBeenCalled();
		expect(links.updateTarget).not.toHaveBeenCalled();
	});

	it("propagates a Kutt authentication failure", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey();
		links.updateTarget.mockRejectedValue(
			new Error("Kutt request failed (HTTP 401)"),
		);

		// Act
		const operation = useCase.execute({ identity, mode: "fix" });

		// Assert
		await expect(operation).rejects.toThrow("HTTP 401");
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(events.ensureEvent).not.toHaveBeenCalled();
		expect(links.updateTarget).toHaveBeenCalledWith(feedbackUrl);
	});

	it("normalizes the public URL and verifies the resulting issue revision before updating Kutt", async () => {
		// Arrange
		const { deps, links, useCase } = journey({
			publicationLinks: {
				...event.publicationLinks,
				feedback: `${feedbackUrl}/`,
			},
		});

		// Act
		const result = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(result).toMatchObject({
			persisted: true,
			linkUpdated: true,
			feedbackUrl,
		});
		expect(deps.repository.applyPatch).toHaveBeenCalledOnce();
		expect(links.updateTarget).toHaveBeenCalledWith(feedbackUrl);
	});

	it("creates and persists missing feedback before switching the event-day short link", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey({
			publicationLinks: event.publicationLinks,
		});

		// Act
		const result = await useCase.execute({ identity, mode: "fix" });
		const repeated = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(result).toMatchObject({
			skipped: false,
			persisted: true,
			feedbackUrl,
			linkUpdated: true,
		});
		expect(events.ensureEvent).toHaveBeenCalledExactlyOnceWith({
			key: `${identity.repository}#${identity.issueNumber}`,
			name: event.eventTitle,
			scheduleUrl: `https://github.com/${identity.repository}/issues/${identity.issueNumber}`,
		});
		expect(deps.repository.applyPatch).toHaveBeenCalledOnce();
		expect(links.updateTarget).toHaveBeenCalledWith(feedbackUrl);
		expect(events.ensureEvent.mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(deps.repository.applyPatch).mock.invocationCallOrder[0],
		);
		expect(
			vi.mocked(deps.repository.applyPatch).mock.invocationCallOrder[0],
		).toBeLessThan(links.updateTarget.mock.invocationCallOrder[0]);
		expect(repeated.persisted).toBe(false);
	});

	it("reports planned creation without calling any write gateway in check mode", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey({
			publicationLinks: event.publicationLinks,
		});

		// Act
		const result = await useCase.execute({ identity, mode: "check" });

		// Assert
		expect(result).toMatchObject({
			persisted: false,
			linkUpdated: false,
			diagnostics: [{ code: "publication.feedback.creation-pending" }],
		});
		expect(result.feedbackUrl).toBeUndefined();
		expect(events.ensureEvent).not.toHaveBeenCalled();
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(links.updateTarget).not.toHaveBeenCalled();
	});

	it("prepares future feedback without changing the shared short link", async () => {
		// Arrange
		const { events, links, useCase } = journey(
			{ publicationLinks: event.publicationLinks },
			"2026-09-29T10:00:00Z",
		);

		// Act
		const result = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(result).toMatchObject({
			persisted: true,
			feedbackUrl,
			linkUpdated: false,
		});
		expect(events.ensureEvent).toHaveBeenCalledOnce();
		expect(links.updateTarget).not.toHaveBeenCalled();
	});

	it("limits the event name to the API maximum length", async () => {
		// Arrange
		const { events, useCase } = journey({
			publicationLinks: event.publicationLinks,
			eventTitle: "A".repeat(120),
		});

		// Act
		await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(events.ensureEvent).toHaveBeenCalledWith(
			expect.objectContaining({ name: "A".repeat(100) }),
		);
	});

	it("requires a title before creating an event", async () => {
		// Arrange
		const { events, useCase } = journey({
			publicationLinks: event.publicationLinks,
			eventTitle: "",
		});

		// Act
		const result = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({ code: "publication.feedback.prerequisites" }),
		);
		expect(events.ensureEvent).not.toHaveBeenCalled();
	});

	it("does not create feedback after the source issue changes", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey({
			publicationLinks: event.publicationLinks,
		});
		vi.mocked(deps.repository.find)
			.mockResolvedValueOnce(sourceDocument)
			.mockResolvedValue({ ...sourceDocument, body: "human edit" });

		// Act
		const operation = useCase.execute({ identity, mode: "fix" });

		// Assert
		await expect(operation).rejects.toMatchObject({
			name: "EventConcurrentModificationError",
		});
		expect(events.ensureEvent).not.toHaveBeenCalled();
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(links.updateTarget).not.toHaveBeenCalled();
	});

	it("preserves issue edits made during event creation", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey({
			publicationLinks: event.publicationLinks,
		});
		events.ensureEvent.mockImplementation(async () => {
			vi.mocked(deps.repository.find).mockResolvedValue({
				...sourceDocument,
				body: "human edit",
			});
			return feedbackUrl;
		});

		// Act
		const operation = useCase.execute({ identity, mode: "fix" });

		// Assert
		await expect(operation).rejects.toMatchObject({
			name: "EventConcurrentModificationError",
		});
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(links.updateTarget).not.toHaveBeenCalled();
	});

	it("reuses the same source key after a failed issue save", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey({
			publicationLinks: event.publicationLinks,
		});
		vi.mocked(deps.repository.applyPatch).mockRejectedValueOnce(
			new Error("Issue save failed"),
		);

		// Act
		const firstError = await useCase
			.execute({ identity, mode: "fix" })
			.catch((error: unknown) => error);
		const retried = await useCase.execute({ identity, mode: "fix" });

		// Assert
		expect(firstError).toMatchObject({ message: "Issue save failed" });
		expect(retried).toMatchObject({
			persisted: true,
			feedbackUrl,
			linkUpdated: true,
		});
		expect(events.ensureEvent).toHaveBeenCalledTimes(2);
		expect(events.ensureEvent.mock.calls[0]).toEqual(
			events.ensureEvent.mock.calls[1],
		);
		expect(links.updateTarget).toHaveBeenCalledOnce();
	});

	it("does not save or publish feedback when event creation fails", async () => {
		// Arrange
		const { deps, events, links, useCase } = journey({
			publicationLinks: event.publicationLinks,
		});
		events.ensureEvent.mockRejectedValue(
			new Error("OpenFeedback request failed (HTTP 401)"),
		);

		// Act
		const operation = useCase.execute({ identity, mode: "fix" });

		// Assert
		await expect(operation).rejects.toThrow("HTTP 401");
		expect(deps.repository.applyPatch).not.toHaveBeenCalled();
		expect(links.updateTarget).not.toHaveBeenCalled();
	});
});
