import { getOctokit } from "@actions/github";
import type { EventDocument, EventRepository } from "@meetup-automation/event";
import {
	ManageMeetupEvent,
	ManageMeetupFeedback,
} from "@meetup-automation/journey";
import { OpenFeedbackEventGateway } from "@meetup-automation/openfeedback-event-gateway";
import { describe, expect, it, vi } from "vitest";
import { SERVICES } from "./composition.js";
import {
	FEEDBACK_EVENTS,
	FEEDBACK_LINKS,
	FeedbackComposition,
} from "./feedback-composition.js";

const input = {
	client: getOctokit("synthetic-token"),
	owner: "example",
	repo: "meetups",
	commentAuthorLogin: "example[bot]",
	workspaceRoot: "/must-not-read",
	kuttApiKey: "synthetic-key",
	kuttLinkId: "link-1",
	openFeedbackApiKey: "oforg_synthetic-key",
};

describe("feedback composition", () => {
	it("allows replacing feedback providers before resolving the journey", async () => {
		// Arrange
		const identity = { repository: "example/meetups", issueNumber: 12 };
		const container = FeedbackComposition.createFeedbackContainer({
			...input,
		});
		const links = { updateTarget: vi.fn() };
		const events = { ensureEvent: vi.fn() };
		container.rebind(FEEDBACK_EVENTS).toConstantValue(events);
		container.rebind(FEEDBACK_LINKS).toConstantValue(links);
		container
			.rebind<EventRepository>(SERVICES.eventRepository)
			.toConstantValue({
				find: vi.fn().mockResolvedValue({
					identity,
					issueTitle: "Unrelated",
					issueState: "open",
					body: "",
					labels: [],
				}),
				applyPatch: vi.fn(),
				listPage: vi.fn(),
			});

		// Act
		const result = await container
			.get(ManageMeetupFeedback)
			.execute({ identity });

		// Assert
		expect(result.skipped).toBe(true);
		expect(events.ensureEvent).not.toHaveBeenCalled();
		expect(links.updateTarget).not.toHaveBeenCalled();
	});

	it("binds the required event gateway", () => {
		// Arrange
		const container = FeedbackComposition.createFeedbackContainer({
			...input,
		});

		// Act
		const gateway = container.get(FEEDBACK_EVENTS);

		// Assert
		expect(gateway).toBeInstanceOf(OpenFeedbackEventGateway);
	});

	it("injects a replacement event gateway into feedback creation", async () => {
		// Arrange
		const container = FeedbackComposition.createFeedbackContainer({
			...input,
		});
		const identity = { repository: "example/meetups", issueNumber: 12 };
		const source: EventDocument = {
			identity,
			issueTitle: "[Meetup] Platform evening",
			issueState: "open",
			body: "synthetic event document",
			labels: ["meetup"],
		};
		const event = {
			...source,
			eventTitle: "Platform evening",
			date: "2030-09-30",
			timeZone: "Europe/Paris",
			publicationLinks: {},
		};
		const feedbackUrl = "https://openfeedback.io/synthetic-event";
		const events = { ensureEvent: vi.fn().mockResolvedValue(feedbackUrl) };
		const applyPatch = vi.fn();
		container.rebind(FEEDBACK_EVENTS).toConstantValue(events);
		container.rebind(FEEDBACK_LINKS).toConstantValue({ updateTarget: vi.fn() });
		container.rebind(SERVICES.eventRepository).toConstantValue({
			find: vi.fn().mockResolvedValue(source),
			applyPatch,
			listPage: vi.fn(),
		});
		container.rebind(SERVICES.eventDocumentCodec).toConstantValue({
			decode: vi.fn().mockReturnValue({ event, diagnostics: [] }),
			createPatch: vi.fn().mockReturnValue({ body: "event with feedback URL" }),
		});
		container.rebind(SERVICES.eventClock).toConstantValue({
			now: () => "2030-09-29T10:00:00Z",
		});
		container
			.rebind<Pick<ManageMeetupEvent, "execute">>(ManageMeetupEvent)
			.toConstantValue({
				execute: vi
					.fn()
					.mockResolvedValue({ skipped: false, event, diagnostics: [] }),
			});

		// Act
		const result = await container
			.get(ManageMeetupFeedback)
			.execute({ identity });

		// Assert
		expect(events.ensureEvent).toHaveBeenCalledWith({
			key: "example/meetups#12",
			name: "Platform evening",
			scheduleUrl: "https://github.com/example/meetups/issues/12",
		});
		expect(result).toMatchObject({ feedbackUrl, persisted: true });
		expect(applyPatch).toHaveBeenCalledOnce();
	});
});
