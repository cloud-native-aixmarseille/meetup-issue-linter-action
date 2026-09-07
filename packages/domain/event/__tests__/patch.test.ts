import { describe, expect, it } from "vitest";
import {
	applyEventPatch,
	cloneMeetupEvent,
	createEventPatch,
	EXPECTED_POST_EVENT_TASK_NAMES,
	mergeEventPatches,
	replaceEventField,
} from "../src/index.js";
import { createTestEvent } from "./test-event.js";

describe("immutable event patches", () => {
	it("applies every supported field operation without changing the source", () => {
		const source = createTestEvent();
		const patch = createEventPatch([
			replaceEventField("issueTitle", "Projected title", "test"),
			replaceEventField("labels", ["meetup"], "test"),
			replaceEventField("eventTitle", "New event title", "test"),
			replaceEventField("date", "2026-10-01", "test"),
			replaceEventField("description", "New description", "test"),
			replaceEventField("host", undefined, "test"),
			replaceEventField("agenda", [], "test"),
			replaceEventField("publicationLinks", {}, "test"),
			replaceEventField("occurrenceStatus", "postponed", "test"),
			replaceEventField("timeZone", "UTC", "test"),
			replaceEventField(
				"confirmations",
				{ host: false, speakers: false },
				"test",
			),
			replaceEventField(
				"logistics",
				{ aperitif: "not-planned", postEventVenue: "planned" },
				"test",
			),
			replaceEventField(
				"operationalChecklists",
				{
					slidesAndContent: [{ name: "Basic Slides", completed: true }],
					communication: [{ name: "Announcement", completed: true }],
					postEvent: EXPECTED_POST_EVENT_TASK_NAMES.map((name) => ({
						name,
						completed: true,
					})),
				},
				"test",
			),
			replaceEventField("followUpComplete", true, "test"),
		]);

		const result = applyEventPatch(source, patch);

		expect(result).toMatchObject({
			issueTitle: "Projected title",
			labels: ["meetup"],
			eventTitle: "New event title",
			date: "2026-10-01",
			description: "New description",
			host: undefined,
			agenda: [],
			publicationLinks: {},
			occurrenceStatus: "postponed",
			timeZone: "UTC",
			confirmations: { host: false, speakers: false },
			logistics: { aperitif: "not-planned", postEventVenue: "planned" },
			operationalChecklists: {
				slidesAndContent: [{ name: "Basic Slides", completed: true }],
				communication: [{ name: "Announcement", completed: true }],
				postEvent: EXPECTED_POST_EVENT_TASK_NAMES.map((name) => ({
					name,
					completed: true,
				})),
			},
			followUpComplete: true,
		});
		expect(source.issueTitle).not.toBe(result.issueTitle);
		expect(source.host).toBeDefined();
	});

	it("does not apply a completion flag without exact named task evidence", () => {
		const source = createTestEvent({
			operationalChecklists: {
				slidesAndContent: [],
				communication: [],
				postEvent: [{ name: "Mail thanks hoster", completed: true }],
			},
		});

		expect(
			applyEventPatch(
				source,
				createEventPatch([replaceEventField("followUpComplete", true, "test")]),
			).followUpComplete,
		).toBe(false);
		expect(
			cloneMeetupEvent({ ...source, followUpComplete: true }).followUpComplete,
		).toBe(false);
	});

	it("invalidates completion when the named checklist becomes incomplete", () => {
		const source = createTestEvent({
			followUpComplete: true,
			operationalChecklists: {
				slidesAndContent: [],
				communication: [],
				postEvent: EXPECTED_POST_EVENT_TASK_NAMES.map((name) => ({
					name,
					completed: true,
				})),
			},
		});
		const result = applyEventPatch(
			source,
			createEventPatch([
				replaceEventField(
					"operationalChecklists",
					{
						...source.operationalChecklists,
						postEvent: source.operationalChecklists.postEvent.slice(0, 4),
					},
					"test",
				),
			]),
		);

		expect(result.followUpComplete).toBe(false);
	});

	it("clones nested event data and merges operation lists", () => {
		const source = createTestEvent();
		const clone = cloneMeetupEvent(source);
		const merged = mergeEventPatches(
			createEventPatch([
				replaceEventField("eventTitle", "First", "first patch"),
			]),
			createEventPatch([
				replaceEventField("description", "Second", "second patch"),
			]),
		);

		expect(clone).toEqual(source);
		expect(clone).not.toBe(source);
		expect(clone.agenda).not.toBe(source.agenda);
		expect(clone.logistics).not.toBe(source.logistics);
		expect(clone.operationalChecklists).not.toBe(source.operationalChecklists);
		expect(clone.operationalChecklists.postEvent).not.toBe(
			source.operationalChecklists.postEvent,
		);
		expect(applyEventPatch(source, merged)).toMatchObject({
			eventTitle: "First",
			description: "Second",
		});
	});
});
