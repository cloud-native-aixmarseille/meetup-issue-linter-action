import { describe, expect, it } from "vitest";
import {
	EXPECTED_POST_EVENT_TASK_NAMES,
	evaluateEventLifecycle,
	evaluateEventReadiness,
	migrateMeetupEventDto,
	parseParticipantReference,
	postEventChecklistIsComplete,
} from "../src/index.js";
import { createTestEvent } from "./test-event.js";

describe("event DTO migration", () => {
	it("clones a current DTO without migration diagnostics", () => {
		const current = createTestEvent();
		const result = migrateMeetupEventDto(current);

		expect(result.event).toEqual(current);
		expect(result.event).not.toBe(current);
		expect(result.diagnostics).toEqual([]);
	});

	it("migrates the historical parser payload without retaining presentation URLs", () => {
		const result = migrateMeetupEventDto({
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 12,
			issueTitle: "Legacy title",
			labels: ["meetup", "hoster:confirmed"],
			followUpComplete: true,
			parsedBody: {
				event_date: "2026-11-05",
				event_title: "Legacy event",
				hoster: ["[Aix Tech Hub](https://example.com/host)"],
				event_description: "Description",
				agenda:
					"- [Ada Lovelace](https://example.com/ada), Grace Hopper [speaker-2]: Platform history: lessons learned",
				event_status: "scheduled",
			},
		});

		expect(result.event).toMatchObject({
			schemaVersion: 1,
			host: { displayName: "Aix Tech Hub" },
			agenda: [
				{
					speakers: [
						{ displayName: "Ada Lovelace" },
						{ id: "speaker-2", displayName: "Grace Hopper" },
					],
					description: "Platform history: lessons learned",
				},
			],
			confirmations: { host: true, speakers: false },
			logistics: {
				aperitif: "unspecified",
				postEventVenue: "unspecified",
			},
			operationalChecklists: {
				slidesAndContent: [],
				communication: [],
				postEvent: [],
			},
			followUpComplete: false,
		});
		expect(result.diagnostics[0]?.code).toBe("event.document.legacy-schema");
	});

	it("reports invalid legacy field types instead of throwing", () => {
		const result = migrateMeetupEventDto({
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 13,
			issueTitle: "Legacy title",
			parsedBody: {
				event_date: 123,
				hoster: "not-an-array",
				agenda: ["not-a-string"],
				event_status: "finished",
			},
		});

		expect(
			result.diagnostics.filter((item) => item.severity === "error"),
		).toHaveLength(4);
	});

	it("derives occurrence status from explicit operational labels", () => {
		const cancelled = migrateMeetupEventDto({
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 15,
			issueTitle: "Legacy title",
			issueState: "open",
			labels: ["meetup", "event:cancelled"],
			parsedBody: {},
		});
		expect(cancelled.event.occurrenceStatus).toBe("cancelled");

		const postponed = migrateMeetupEventDto({
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 16,
			issueTitle: "Legacy title",
			issueState: "open",
			labels: ["meetup", "event:postponed"],
			parsedBody: {},
		});
		expect(postponed.event.occurrenceStatus).toBe("postponed");
	});

	it("treats a closed issue as held when no explicit occurrence label is present", () => {
		const result = migrateMeetupEventDto({
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 17,
			issueTitle: "Legacy title",
			issueState: "closed",
			labels: ["meetup"],
			parsedBody: {},
		});

		expect(result.event.occurrenceStatus).toBe("held");
	});

	it("reports ambiguous and malformed legacy structures", () => {
		const result = migrateMeetupEventDto({
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 14,
			issueTitle: "Legacy title",
			parsedBody: {
				hoster: ["First host", "Second host"],
				agenda: "not a valid agenda line",
				meetup_link: 123,
			},
		});

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "event.hoster.multiple" }),
				expect.objectContaining({
					code: "event.agenda.legacy-line-invalid",
				}),
				expect.objectContaining({
					code: "event.document.invalid-field-type",
					field: "meetup_link",
				}),
			]),
		);
	});

	it("parses markdown and stable ID participant references", () => {
		expect(
			parseParticipantReference(
				"[Ada Lovelace](https://example.com/speakers/ada)",
			),
		).toEqual({ displayName: "Ada Lovelace" });
		expect(parseParticipantReference("Grace Hopper\t[speaker-0002]")).toEqual({
			displayName: "Grace Hopper",
			id: "speaker-0002",
		});
	});
});

describe("readiness and lifecycle", () => {
	it("does not infer held from a past event date", () => {
		const event = createTestEvent({
			date: "2020-01-01",
			occurrenceStatus: "scheduled",
		});
		const readiness = evaluateEventReadiness(event, []);

		const lifecycle = evaluateEventLifecycle({
			event,
			readiness,
			now: "2030-01-01T00:00:00Z",
		});

		expect(readiness.status).toBe("ready");
		expect(lifecycle.state).toBe("ready");
		expect(lifecycle.evaluatedAt).toBe("2030-01-01T00:00:00Z");
	});

	it.each([
		["postponed", "postponed"],
		["cancelled", "cancelled"],
		["held", "held"],
	] as const)("derives %s occurrence as %s", (occurrenceStatus, expected) => {
		const event = createTestEvent({ occurrenceStatus });
		const lifecycle = evaluateEventLifecycle({
			event,
			readiness: evaluateEventReadiness(event, []),
			now: "2026-09-04T10:00:00+02:00",
		});
		expect(lifecycle.state).toBe(expected);
	});

	it("derives follow-up completion from the exact checklist", () => {
		const event = createTestEvent({
			occurrenceStatus: "held",
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

		expect(
			evaluateEventLifecycle({
				event,
				readiness: evaluateEventReadiness(event, []),
				now: "2026-09-04T10:00:00+02:00",
			}).state,
		).toBe("follow-up-complete");
	});

	it("does not trust a legacy completion flag without the exact checklist", () => {
		const event = createTestEvent({
			occurrenceStatus: "held",
			followUpComplete: true,
			operationalChecklists: {
				slidesAndContent: [],
				communication: [],
				postEvent: [{ name: "Mail thanks hoster", completed: true }],
			},
		});

		expect(
			evaluateEventLifecycle({
				event,
				readiness: evaluateEventReadiness(event, []),
				now: "2026-09-04T10:00:00+02:00",
			}).state,
		).toBe("held");
	});

	it("distinguishes incomplete confirmation from invalid diagnostics", () => {
		const incomplete = createTestEvent({
			confirmations: { host: false, speakers: true },
		});
		expect(evaluateEventReadiness(incomplete, []).status).toBe("incomplete");

		const invalid = evaluateEventReadiness(createTestEvent(), [
			{
				code: "event.date.invalid",
				severity: "error",
				category: "invalid",
				message: "Invalid date",
			},
		]);
		expect(invalid.status).toBe("invalid");
	});

	it("keeps a minimally populated event in draft", () => {
		const event = createTestEvent({
			eventTitle: "",
			date: "",
			occurrenceStatus: undefined,
		});
		const lifecycle = evaluateEventLifecycle({
			event,
			readiness: evaluateEventReadiness(event, []),
			now: "2026-09-04T10:00:00+02:00",
		});

		expect(lifecycle.state).toBe("draft");
	});

	it.each([
		"postponed",
		"cancelled",
	] as const)("never marks an explicitly %s event ready", (occurrenceStatus) => {
		const readiness = evaluateEventReadiness(
			createTestEvent({ occurrenceStatus }),
			[],
		);
		expect(readiness).toMatchObject({ status: "incomplete", isReady: false });
	});
});

describe("post-event checklist completion", () => {
	const completedExpectedTasks = EXPECTED_POST_EVENT_TASK_NAMES.map((name) => ({
		name,
		completed: true,
	}));

	it("requires every expected named task to be completed", () => {
		expect(postEventChecklistIsComplete(completedExpectedTasks)).toBe(true);
		expect(
			postEventChecklistIsComplete([...completedExpectedTasks].reverse()),
		).toBe(true);
	});

	it.each([
		{
			name: "an all-checked subset",
			items: completedExpectedTasks.slice(0, 2),
		},
		{
			name: "an unchecked expected task",
			items: completedExpectedTasks.map((item, index) =>
				index === 2 ? { ...item, completed: false } : item,
			),
		},
		{
			name: "a duplicate replacing an expected task",
			items: [
				...completedExpectedTasks.slice(0, -1),
				completedExpectedTasks[0],
			],
		},
		{
			name: "an additional unknown task",
			items: [
				...completedExpectedTasks,
				{ name: "Unexpected task", completed: true },
			],
		},
	])("rejects $name", ({ items }) => {
		expect(postEventChecklistIsComplete(items)).toBe(false);
	});
});
