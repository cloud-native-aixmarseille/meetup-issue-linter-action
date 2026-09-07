import { describe, expect, it } from "vitest";
import {
	type CommunicationApprovalFacts,
	communicationApprovalFactsEqual,
	communicationApprovalMatches,
	createCommunicationApprovalSnapshot,
	parseCommunicationApprovalSnapshot,
} from "./index.js";

const FACTS: CommunicationApprovalFacts = {
	automationRevision: "revision-abc123",
	eventId: "issue-42",
	eventDate: "2026-10-08",
	occurrenceStatus: "scheduled",
	readiness: "ready",
	policyVersion: "1",
	mailingsRepository: "organization/mailings",
	notificationEnabled: true,
	notificationDestinationFingerprint: `sha256:${"a".repeat(64)}`,
	confirmations: { host: true, speakers: true },
	hostId: "host-0001",
	speakerIds: ["speaker-0002", "speaker-0001"],
	publicationUrls: {
		meetup: "https://meetup.example/events/42",
		community: "https://community.example/events/42",
		assets: "https://assets.example/folders/42",
	},
};

describe("communication approval snapshots", () => {
	it("creates a deeply immutable canonical snapshot", () => {
		const snapshot = createCommunicationApprovalSnapshot({
			...FACTS,
			eventId: " issue-42 ",
			speakerIds: ["speaker-0002", "speaker-0001", "speaker-0002"],
			publicationUrls: {
				meetup: " https://meetup.example/events/42/ ",
				community: null,
				assets: "",
			},
		});

		expect(snapshot).toEqual({
			schemaVersion: 1,
			facts: {
				...FACTS,
				eventId: "issue-42",
				speakerIds: ["speaker-0001", "speaker-0002"],
				publicationUrls: {
					meetup: "https://meetup.example/events/42",
					community: null,
					assets: null,
				},
			},
		});
		expect(Object.isFrozen(snapshot)).toBe(true);
		expect(Object.isFrozen(snapshot.facts)).toBe(true);
		expect(Object.isFrozen(snapshot.facts.confirmations)).toBe(true);
		expect(Object.isFrozen(snapshot.facts.speakerIds)).toBe(true);
		expect(Object.isFrozen(snapshot.facts.publicationUrls)).toBe(true);
	});

	it("treats speaker identity as an order-independent set", () => {
		expect(
			communicationApprovalFactsEqual(FACTS, {
				...FACTS,
				speakerIds: ["speaker-0001", "speaker-0002", "speaker-0001"],
			}),
		).toBe(true);
	});

	it.each([
		["automation revision", { automationRevision: "revision-def456" }],
		["event identity", { eventId: "issue-43" }],
		["event date", { eventDate: "2026-10-09" }],
		["occurrence status", { occurrenceStatus: "held" }],
		["readiness", { readiness: "not-ready" }],
		["policy version", { policyVersion: "2" }],
		["mail route", { mailingsRepository: "organization/new-mailings" }],
		[
			"notification policy",
			{
				notificationEnabled: false,
				notificationDestinationFingerprint: null,
			},
		],
		[
			"notification route",
			{ notificationDestinationFingerprint: `sha256:${"b".repeat(64)}` },
		],
		["host confirmation", { confirmations: { host: false, speakers: true } }],
		[
			"speaker confirmation",
			{ confirmations: { host: true, speakers: false } },
		],
		["host identity", { hostId: "host-0002" }],
		["speaker identity", { speakerIds: ["speaker-0001"] }],
		[
			"Meetup URL",
			{
				publicationUrls: {
					...FACTS.publicationUrls,
					meetup: "https://meetup.example/events/43",
				},
			},
		],
		[
			"community URL",
			{
				publicationUrls: {
					...FACTS.publicationUrls,
					community: "https://community.example/events/43",
				},
			},
		],
		[
			"assets URL",
			{
				publicationUrls: {
					...FACTS.publicationUrls,
					assets: "https://assets.example/folders/43",
				},
			},
		],
	] as const)("invalidates approval when %s changes", (_label, override) => {
		const approved = createCommunicationApprovalSnapshot(FACTS);
		const current = { ...FACTS, ...override } as CommunicationApprovalFacts;

		expect(communicationApprovalMatches(approved, current)).toBe(false);
	});

	it("rejects invalid event facts without echoing their values", () => {
		for (const facts of [
			{ ...FACTS, automationRevision: "not safe!" },
			{ ...FACTS, eventDate: "2026-02-30" },
			{ ...FACTS, hostId: "not safe!" },
			{ ...FACTS, speakerIds: ["speaker-9001", "not safe!"] },
			{
				...FACTS,
				notificationEnabled: false,
				notificationDestinationFingerprint: `sha256:${"b".repeat(64)}`,
			},
			{
				...FACTS,
				notificationDestinationFingerprint: "not-a-fingerprint",
			},
			{
				...FACTS,
				publicationUrls: {
					...FACTS.publicationUrls,
					assets: "http://assets.example/private",
				},
			},
		] as CommunicationApprovalFacts[]) {
			expect(() => createCommunicationApprovalSnapshot(facts)).toThrow();
		}
	});

	it("strictly rejects stored contact fields and never serializes extras", () => {
		const source = {
			schemaVersion: 1,
			facts: { ...FACTS, email: "private@example.invalid" },
		};
		expect(() => parseCommunicationApprovalSnapshot(source)).toThrow(
			/invalid schema/,
		);

		const snapshot = createCommunicationApprovalSnapshot({
			...FACTS,
			email: "private@example.invalid",
		} as CommunicationApprovalFacts & {
			readonly email: string;
		});
		expect(JSON.stringify(snapshot)).not.toContain("email");
		expect(JSON.stringify(snapshot)).not.toContain("private@example.invalid");
	});

	it("parses and canonicalizes a strict stored snapshot", () => {
		const parsed = parseCommunicationApprovalSnapshot({
			schemaVersion: 1,
			facts: {
				...FACTS,
				speakerIds: ["speaker-0002", "speaker-0001", "speaker-0001"],
			},
		});

		expect(parsed.facts.speakerIds).toEqual(["speaker-0001", "speaker-0002"]);
	});
});
