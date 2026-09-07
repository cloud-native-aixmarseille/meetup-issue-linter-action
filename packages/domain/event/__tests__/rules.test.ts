import { describe, expect, it } from "vitest";
import {
	createDefaultEventRules,
	EMPTY_EVENT_PATCH,
	type EventRule,
	EventRuleConfigurationError,
	EventRuleEngine,
} from "../src/index.js";
import { createTestEvent } from "./test-event.js";

describe("EventRuleEngine", () => {
	it("returns immutable normalization operations without mutating the source", () => {
		const source = createTestEvent({
			issueTitle: "Wrong title",
			labels: ["community"],
			eventTitle: "  Cloud Native Evening  ",
			date: " 2026-09-30 ",
			description: " Description with outer space ",
			host: { id: " host-1 ", displayName: " Aix Tech Hub " },
			agenda: [
				{
					speakers: [{ id: " speaker-1 ", displayName: " Ada Lovelace " }],
					description: " Reliable platforms ",
				},
			],
			publicationLinks: {
				meetup:
					" https://www.meetup.com/cloud-native-aix-marseille/events/123456789/ ",
			},
		});

		const result = new EventRuleEngine(createDefaultEventRules()).evaluate(
			source,
		);

		expect(source.eventTitle).toBe("  Cloud Native Evening  ");
		expect(source.host?.displayName).toBe(" Aix Tech Hub ");
		expect(result.event).toMatchObject({
			issueTitle: "[Meetup] - 2026-09-30 - Cloud Native Evening",
			eventTitle: "Cloud Native Evening",
			date: "2026-09-30",
			description: "Description with outer space",
			host: { id: "host-1", displayName: "Aix Tech Hub" },
			labels: ["community", "meetup", "hoster:confirmed", "speakers:confirmed"],
			publicationLinks: {
				meetup:
					"https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
			},
		});
		expect(result.patch.operations.length).toBeGreaterThan(5);
		expect(result.diagnostics.every((item) => item.fixAvailable)).toBe(true);
	});

	it("distinguishes invalid values from incomplete fields", () => {
		const result = new EventRuleEngine(createDefaultEventRules()).evaluate(
			createTestEvent({
				date: "2025-02-29",
				host: undefined,
				agenda: [],
				publicationLinks: { meetup: "http://example.com/event" },
			}),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "event.date.invalid",
					category: "invalid",
				}),
				expect.objectContaining({
					code: "event.hoster.missing",
					category: "incomplete",
				}),
				expect.objectContaining({ code: "event.agenda.missing" }),
				expect.objectContaining({ code: "event.link.meetup.invalid" }),
			]),
		);
	});

	it("reports malformed agenda participants and descriptions", () => {
		const result = new EventRuleEngine(createDefaultEventRules()).evaluate(
			createTestEvent({
				agenda: [
					{ speakers: [], description: "Talk" },
					{ speakers: [{ displayName: "  " }], description: "  " },
				],
			}),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "event.agenda.speaker.missing" }),
				expect.objectContaining({ code: "event.agenda.speaker.invalid" }),
				expect.objectContaining({ code: "event.agenda.description.missing" }),
			]),
		);
	});

	it("accepts leap-day dates and ignores absent optional links", () => {
		const result = new EventRuleEngine(createDefaultEventRules()).evaluate(
			createTestEvent({
				date: "2024-02-29",
				issueTitle: "[Meetup] - 2024-02-29 - Cloud Native Evening",
				publicationLinks: {},
			}),
		);

		expect(result.diagnostics).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "event.date.invalid" }),
			]),
		);
	});

	it("does not normalize labels when GitHub returns the same labels in a different order", () => {
		const result = new EventRuleEngine(createDefaultEventRules()).evaluate(
			createTestEvent({
				labels: [
					"communication:approved",
					"community",
					"speakers:confirmed",
					"meetup",
					"hoster:confirmed",
				],
			}),
		);

		expect(result.patch.operations).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "labels" })]),
		);
		expect(result.diagnostics).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "event.labels.normalized" }),
			]),
		);
	});

	it("rejects a missing dependency at construction", () => {
		const rule: EventRule = {
			id: "dependent",
			dependencies: ["absent"],
			evaluate: () => ({ diagnostics: [], patch: EMPTY_EVENT_PATCH }),
		};

		expect(() => new EventRuleEngine([rule])).toThrowError(
			new EventRuleConfigurationError(
				'Event rule "dependent" has missing dependency "absent"',
			),
		);
	});

	it("rejects a cycle at construction", () => {
		const first: EventRule = {
			id: "first",
			dependencies: ["second"],
			evaluate: () => ({ diagnostics: [], patch: EMPTY_EVENT_PATCH }),
		};
		const second: EventRule = {
			id: "second",
			dependencies: ["first"],
			evaluate: () => ({ diagnostics: [], patch: EMPTY_EVENT_PATCH }),
		};

		expect(() => new EventRuleEngine([first, second])).toThrowError(
			/Cyclic event rule dependency/,
		);
	});

	it("rejects duplicate rule identifiers", () => {
		const rule: EventRule = {
			id: "same",
			dependencies: [],
			evaluate: () => ({ diagnostics: [], patch: EMPTY_EVENT_PATCH }),
		};

		expect(() => new EventRuleEngine([rule, rule])).toThrowError(
			'Duplicate event rule "same"',
		);
	});
});
