import { describe, expect, it } from "vitest";
import {
	createCommunicationIdempotencyKey,
	MAIL_TEMPLATE_NAMES,
	PlanCommunications,
	type PlanCommunicationsInput,
} from "./index.js";

const planner = new PlanCommunications();

describe("createCommunicationIdempotencyKey", () => {
	it("is deterministic and includes every stable policy dimension", () => {
		const components = {
			repositoryId: "cloud-native-aixmarseille/meetups",
			eventId: "issue:123",
			kind: "host-introduction" as const,
			recipientId: "host-contact-42",
			policyVersion: "communication-v2",
		};

		const key = createCommunicationIdempotencyKey(components);

		expect(createCommunicationIdempotencyKey(components)).toBe(key);
		expect(key).toContain("repository=cloud-native-aixmarseille%2Fmeetups");
		expect(key).toContain("event=issue%3A123");
		expect(key).toContain("kind=host-introduction");
		expect(key).toContain("recipient=host-contact-42");
		expect(key).toContain("policy=communication-v2");

		for (const changed of [
			{ ...components, repositoryId: "another/repository" },
			{ ...components, eventId: "issue:124" },
			{ ...components, kind: "host-thanks" as const },
			{ ...components, recipientId: "host-contact-43" },
			{ ...components, policyVersion: "communication-v3" },
		]) {
			expect(createCommunicationIdempotencyKey(changed)).not.toBe(key);
		}
	});

	it("rejects contact data in identifier positions", () => {
		expect(() =>
			createCommunicationIdempotencyKey({
				repositoryId: "cloud-native-aixmarseille/meetups",
				eventId: "issue:123",
				kind: "host-introduction",
				recipientId: "person@example.test",
				policyVersion: "communication-v2",
			}),
		).toThrow("PII-free");
	});
});

describe("PlanCommunications", () => {
	it("plans host and speaker introductions only for opted-in recipients when ready", () => {
		const result = planner.execute(
			readyInput({
				mailRecipients: [
					mailRecipient("host-1", "hosting", "host@example.test"),
					mailRecipient("speaker-1", "speaker", "speaker@example.test"),
					mailRecipient(
						"speaker-0002",
						"speaker",
						"private@example.test",
						false,
					),
				],
			}),
		);

		expect(result.diagnostics).toEqual([]);
		expect(result.intents).toHaveLength(2);
		expect(result.intents).toEqual([
			expect.objectContaining({
				channel: "mail",
				kind: "host-introduction",
				templateName: MAIL_TEMPLATE_NAMES.hostIntroduction,
			}),
			expect.objectContaining({
				channel: "mail",
				kind: "speaker-introduction",
				templateName: MAIL_TEMPLATE_NAMES.speakerIntroduction,
			}),
		]);
	});

	it("merges event and recipient placeholders without putting either in the key", () => {
		const result = planner.execute(
			readyInput({
				mailPlaceholders: { eventTitle: "A meetup" },
				mailRecipients: [
					{
						...mailRecipient("host-1", "hosting", "host@example.test"),
						placeholders: { contactName: "Private Person" },
					},
				],
			}),
		);

		const [intent] = result.intents;
		expect(intent).toMatchObject({
			placeholders: {
				eventTitle: "A meetup",
				contactName: "Private Person",
			},
		});
		expect(intent?.idempotencyKey).not.toContain("host@example.test");
		expect(intent?.idempotencyKey).not.toContain("Private Person");
	});

	it("keeps idempotency stable when contact data changes", () => {
		const first = planner.execute(
			readyInput({
				mailRecipients: [
					mailRecipient("host-1", "hosting", "old@example.test"),
				],
			}),
		);
		const second = planner.execute(
			readyInput({
				mailRecipients: [
					mailRecipient("host-1", "hosting", "new@example.test"),
				],
			}),
		);

		expect(first.intents[0]?.idempotencyKey).toBe(
			second.intents[0]?.idempotencyKey,
		);
	});

	it("plans reminders on both inclusive readiness-window boundaries", () => {
		for (const [now, eventDate] of [
			["2026-06-08T10:00:00.000Z", "2026-06-08"],
			["2026-06-01T10:00:00.000Z", "2026-06-08"],
		] as const) {
			const result = planner.execute(
				notReadyInput({ now: new Date(now), eventDate }),
			);

			expect(result.intents).toEqual([
				expect.objectContaining({
					channel: "notification",
					kind: "readiness-reminder",
					content: "The meetup is not ready",
				}),
			]);
		}
	});

	it.each([
		["before the window", "2026-05-31T10:00:00.000Z", "2026-06-08"],
		["after the event", "2026-06-09T10:00:00.000Z", "2026-06-08"],
	])("does not plan a reminder %s", (_label, now, eventDate) => {
		const result = planner.execute(
			notReadyInput({ now: new Date(now), eventDate }),
		);

		expect(result.intents).toEqual([]);
	});

	it("uses the Europe/Paris civil date across the spring DST transition", () => {
		const beforeLocalMidnight = planner.execute(
			notReadyInput({
				eventDate: "2026-03-29",
				now: new Date("2026-03-28T22:30:00.000Z"),
				readinessWindowDays: 0,
			}),
		);
		const afterLocalMidnight = planner.execute(
			notReadyInput({
				eventDate: "2026-03-29",
				now: new Date("2026-03-28T23:30:00.000Z"),
				readinessWindowDays: 0,
			}),
		);

		expect(beforeLocalMidnight.intents).toHaveLength(0);
		expect(afterLocalMidnight.intents).toHaveLength(1);
	});

	it("uses civil days and remains stable through the repeated fall DST hour", () => {
		const summerOffsetOccurrence = planner.execute(
			notReadyInput({
				eventDate: "2026-11-01",
				now: new Date("2026-10-25T00:30:00.000Z"),
			}),
		);
		const winterOffsetOccurrence = planner.execute(
			notReadyInput({
				eventDate: "2026-11-01",
				now: new Date("2026-10-25T01:30:00.000Z"),
			}),
		);

		expect(summerOffsetOccurrence.intents).toHaveLength(1);
		expect(winterOffsetOccurrence.intents).toHaveLength(1);
		expect(summerOffsetOccurrence.intents[0]?.idempotencyKey).toBe(
			winterOffsetOccurrence.intents[0]?.idempotencyKey,
		);
	});

	it("plans thanks only from an explicit held state", () => {
		const held = planner.execute(
			baseInput({
				eventDate: "2030-01-01",
				occurrenceStatus: "held",
				readiness: "not-ready",
				mailRecipients: [
					mailRecipient("host-1", "hosting", "host@example.test"),
					mailRecipient("speaker-1", "speaker", "speaker@example.test"),
				],
			}),
		);
		const merelyPast = planner.execute(
			baseInput({
				eventDate: "2025-01-01",
				occurrenceStatus: "scheduled",
				readiness: "ready",
			}),
		);

		expect(held.intents).toEqual([
			expect.objectContaining({
				kind: "host-thanks",
				templateName: MAIL_TEMPLATE_NAMES.hostThanks,
			}),
			expect.objectContaining({
				kind: "speaker-thanks",
				templateName: MAIL_TEMPLATE_NAMES.speakerThanks,
			}),
		]);
		expect(held.intents).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "readiness-reminder" }),
			]),
		);
		expect(merelyPast.intents).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "host-thanks" }),
			]),
		);
		expect(merelyPast.intents).toEqual([]);
	});

	it("does not introduce a ready event whose scheduled date has elapsed", () => {
		const result = planner.execute(
			readyInput({
				eventDate: "2026-05-31",
				now: new Date("2026-06-01T10:00:00.000Z"),
			}),
		);

		expect(result).toEqual({ intents: [], diagnostics: [] });
	});

	it.each([
		"cancelled",
		"postponed",
		"unknown",
	] as const)("does not plan side effects for %s occurrence status", (occurrenceStatus) => {
		const result = planner.execute(baseInput({ occurrenceStatus }));

		expect(result.intents).toEqual([]);
		expect(result.diagnostics).toEqual(
			occurrenceStatus === "unknown"
				? [{ code: "occurrence-status-unknown", severity: "warning" }]
				: [],
		);
	});

	it("deduplicates identical stable recipients", () => {
		const recipient = mailRecipient(
			"speaker-1",
			"speaker",
			"speaker@example.test",
		);
		const result = planner.execute(
			readyInput({ mailRecipients: [recipient, recipient] }),
		);

		expect(result.intents).toHaveLength(1);
		expect(result.diagnostics).toEqual([
			expect.objectContaining({
				code: "duplicate-intent",
				severity: "warning",
			}),
		]);
	});

	it("fails closed when stable identifiers or the explicit instant are invalid", () => {
		const invalidIdentifier = planner.execute(
			readyInput({ eventId: "organizer@example.test" }),
		);
		const invalidClock = planner.execute(
			readyInput({ now: new Date("invalid") }),
		);

		expect(invalidIdentifier).toEqual({
			intents: [],
			diagnostics: [{ code: "invalid-identifier", severity: "error" }],
		});
		expect(invalidClock).toEqual({
			intents: [],
			diagnostics: [{ code: "invalid-clock", severity: "error" }],
		});
	});

	it("skips invalid mail recipients without disclosing contact data", () => {
		const result = planner.execute(
			readyInput({
				mailRecipients: [
					mailRecipient(
						"private@example.test",
						"hosting",
						"private@example.test",
					),
					mailRecipient("host-2", "hosting", "   "),
				],
			}),
		);

		expect(result.intents).toEqual([]);
		expect(result.diagnostics).toEqual([
			{ code: "invalid-identifier", severity: "error" },
			{ code: "missing-mail-destination", severity: "error" },
		]);
		expect(JSON.stringify(result)).not.toContain("private@example.test");
	});

	it("skips opted-out and invalid notification recipients", () => {
		const result = planner.execute(
			notReadyInput({
				notificationRecipients: [
					notificationRecipient(false),
					{
						...notificationRecipient(),
						recipientId: "private@example.test",
					},
					{
						...notificationRecipient(),
						recipientId: "channel-2",
						destination: "",
					},
				],
			}),
		);

		expect(result.intents).toEqual([]);
		expect(result.diagnostics).toEqual([
			{ code: "invalid-identifier", severity: "error" },
			{ code: "missing-notification-destination", severity: "error" },
		]);
	});

	it("requires content before planning a readiness notification", () => {
		const result = planner.execute(notReadyInput({ notificationContent: " " }));

		expect(result).toEqual({
			intents: [],
			diagnostics: [
				{ code: "missing-notification-content", severity: "error" },
			],
		});
	});

	it.each([
		["invalid event date", { eventDate: "2026-02-30" }, "invalid-event-date"],
		["non-ISO event date", { eventDate: "08/06/2026" }, "invalid-event-date"],
		["invalid time zone", { timeZone: "Mars/Olympus" }, "invalid-time-zone"],
		[
			"invalid readiness window",
			{ readinessWindowDays: -1 },
			"invalid-readiness-window",
		],
		[
			"fractional readiness window",
			{ readinessWindowDays: 1.5 },
			"invalid-readiness-window",
		],
	] as const)("fails closed for an %s", (_label, override, diagnosticCode) => {
		const result = planner.execute(notReadyInput(override));

		expect(result.intents).toEqual([]);
		expect(result.diagnostics).toContainEqual({
			code: diagnosticCode,
			severity: "error",
		});
	});
});

function baseInput(
	override: Partial<PlanCommunicationsInput> = {},
): PlanCommunicationsInput {
	return {
		repositoryId: "cloud-native-aixmarseille/meetups",
		eventId: "issue:123",
		eventDate: "2026-06-08",
		timeZone: "Europe/Paris",
		readiness: "ready",
		occurrenceStatus: "scheduled",
		policyVersion: "communication-v2",
		readinessWindowDays: 7,
		mailRecipients: [mailRecipient("host-1", "hosting", "host@example.test")],
		notificationRecipients: [notificationRecipient()],
		mailPlaceholders: { eventTitle: "A meetup" },
		notificationContent: "The meetup is not ready",
		now: new Date("2026-06-01T10:00:00.000Z"),
		...override,
	};
}

function readyInput(
	override: Partial<PlanCommunicationsInput> = {},
): PlanCommunicationsInput {
	return baseInput({ readiness: "ready", ...override });
}

function notReadyInput(
	override: Partial<PlanCommunicationsInput> = {},
): PlanCommunicationsInput {
	return baseInput({
		readiness: "not-ready",
		mailRecipients: [],
		...override,
	});
}

function mailRecipient(
	recipientId: string,
	role: "hosting" | "speaker",
	email: string,
	receivesCommunications = true,
) {
	return {
		channel: "mail" as const,
		recipientId,
		role,
		email,
		receivesCommunications,
	};
}

function notificationRecipient(receivesCommunications = true) {
	return {
		channel: "notification" as const,
		recipientId: "organizers-slack",
		role: "organizers" as const,
		destination: "slack-channel-id",
		receivesCommunications,
	};
}
