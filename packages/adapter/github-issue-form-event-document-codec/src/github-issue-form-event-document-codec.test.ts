import type { EventDocument, MeetupEvent } from "@meetup-automation/event";
import { GitHubIssueFormEventDocumentCodec } from "./github-issue-form-event-document-codec.js";

const LEGACY_BODY = `Introductory text that is not managed.

### Event Title

  Platform Engineering Night  

### Event Date

2026-11-05

### Hoster

[Aix Tech Hub](https://example.test/legacy-host-line)

### Event Description

An event description.

### Agenda

- [Ada Lovelace](https://example.test/legacy-speaker-line), Grace Hopper [speaker-0002]: Platform history

### Meetup Link

https://www.meetup.com/cloud-native-aix-marseille/events/123/

### CNCF Link

https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/example/

### Drive Link

_No response_

### Slides & Content

- [x] Basic Slides
- [ ] Slides hoster

### Communication

- [x] Announcement

### Aperitif

Yes

### Restaurant / Bar

No

### Post event

- [x] Mail thanks hoster
- [x] Mail thanks speakers
- [x] Share slides to meetup
- [x] Sync attendees from tally sheet to CNCF
- [x] Social networks

### Event Status

held

### Unmanaged Section

This exact content must survive.
`;

function document(override: Partial<EventDocument> = {}): EventDocument {
	return {
		identity: {
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 42,
		},
		issueState: "open",
		issueTitle: "Legacy issue title",
		labels: ["meetup", "hoster:confirmed", "speakers:confirmed"],
		body: LEGACY_BODY,
		...override,
	};
}

function normalizedEvent(override: Partial<MeetupEvent> = {}): MeetupEvent {
	return {
		schemaVersion: 1,
		identity: {
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 42,
		},
		issueState: "open",
		issueTitle: "[Meetup] - 2026-11-05 - Platform Engineering Night",
		labels: [
			"meetup",
			"hoster:confirmed",
			"speakers:confirmed",
			"event:held",
			"custom",
		],
		eventTitle: "Platform Engineering Night",
		date: "2026-11-05",
		description: "An event description.",
		host: { id: "host-0001", displayName: "Aix Tech Hub" },
		agenda: [
			{
				speakers: [
					{ id: "speaker-0001", displayName: "Ada Lovelace" },
					{ id: "speaker-0002", displayName: "Grace Hopper" },
				],
				description: "Platform history",
			},
		],
		publicationLinks: {
			meetup: "https://www.meetup.com/cloud-native-aix-marseille/events/123",
			community:
				"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/example",
		},
		occurrenceStatus: "held",
		timeZone: "Europe/Paris",
		confirmations: { host: true, speakers: true },
		logistics: {
			aperitif: "planned",
			postEventVenue: "not-planned",
		},
		operationalChecklists: {
			slidesAndContent: [
				{ name: "Basic Slides", completed: true },
				{ name: "Slides hoster", completed: false },
			],
			communication: [{ name: "Announcement", completed: true }],
			postEvent: [
				{ name: "Mail thanks hoster", completed: true },
				{ name: "Mail thanks speakers", completed: true },
				{ name: "Share slides to meetup", completed: true },
				{
					name: "Sync attendees from tally sheet to CNCF",
					completed: true,
				},
				{ name: "Social networks", completed: true },
			],
		},
		followUpComplete: true,
		...override,
	};
}

describe("GitHubIssueFormEventDocumentCodec", () => {
	it("decodes an unmarked issue as legacy schema 0 without issue-ops", () => {
		// Arrange
		// No additional setup is needed.

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(document());
		const actual = result.diagnostics.map(({ code }) => code);

		// Assert
		expect(result.event).toMatchObject({
			schemaVersion: 1,
			eventTitle: "Platform Engineering Night",
			date: "2026-11-05",
			host: { displayName: "Aix Tech Hub" },
			agenda: [
				{
					speakers: [
						{ displayName: "Ada Lovelace" },
						{ id: "speaker-0002", displayName: "Grace Hopper" },
					],
					description: "Platform history",
				},
			],
			occurrenceStatus: "held",
			confirmations: { host: true, speakers: true },
			logistics: {
				aperitif: "planned",
				postEventVenue: "not-planned",
			},
			operationalChecklists: {
				slidesAndContent: [
					{ name: "Basic Slides", completed: true },
					{ name: "Slides hoster", completed: false },
				],
				communication: [{ name: "Announcement", completed: true }],
			},
			followUpComplete: true,
		});
		expect(actual).toContain("event.document.legacy-schema");
	});

	it("does not mark an arbitrary checked post-event subset complete", () => {
		// Arrange
		const body = LEGACY_BODY.replace(
			`- [x] Mail thanks hoster
- [x] Mail thanks speakers
- [x] Share slides to meetup
- [x] Sync attendees from tally sheet to CNCF
- [x] Social networks`,
			`- [x] Mail thanks hoster
- [x] Mail thanks speakers`,
		);

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(
			document({ body }),
		);

		// Assert
		expect(result.event.followUpComplete).toBe(false);
		expect(result.event.operationalChecklists.postEvent).toEqual([
			{ name: "Mail thanks hoster", completed: true },
			{ name: "Mail thanks speakers", completed: true },
		]);
	});

	it("does not mark a malformed post-event checklist complete", () => {
		// Arrange
		const body = LEGACY_BODY.replace(
			"- [x] Social networks",
			"- [x] Social networks\nmalformed extra line",
		);

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(
			document({ body }),
		);
		const patch = new GitHubIssueFormEventDocumentCodec().createPatch(
			document({ body }),
			result.event,
		);

		// Assert
		expect(result.event.operationalChecklists.postEvent).toHaveLength(5);
		expect(result.event.followUpComplete).toBe(false);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "event.document.checkbox.invalid",
				field: "Post event",
			}),
		);
		expect(patch.body).toContain("malformed extra line");
	});

	it("decodes schema 1 and restores PII-free stable reference metadata", () => {
		// Arrange
		const body = `<!-- meetup-event-schema:1 -->
<!-- meetup-event-references:{"schemaVersion":2,"host":{"id":"host-0001","displayName":"Aix Tech Hub"},"speakers":[{"id":"speaker-0001","displayName":"Ada Lovelace"},{"id":"speaker-0002","displayName":"Grace Hopper"}]} -->
${LEGACY_BODY}`;

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(
			document({ body }),
		);
		const actual = result.event.agenda[0].speakers.map(({ id }) => id);
		const actual1 = result.diagnostics.map(({ code }) => code);

		// Assert
		expect(result.event.host?.id).toBe("host-0001");
		expect(actual).toEqual(["speaker-0001", "speaker-0002"]);
		expect(actual1).not.toContain("event.document.legacy-schema");
	});

	it("accepts managed markers with padded whitespace", () => {
		// Arrange
		const body = `<!--   meetup-event-schema   :   1   -->
<!--\tmeetup-event-references\t:\t{"schemaVersion":2,"host":{"id":"host-0001","displayName":"Aix Tech Hub"},"speakers":[{"id":"speaker-0001","displayName":"Ada Lovelace"},{"id":"speaker-0002","displayName":"Grace Hopper"}]}\t-->
${LEGACY_BODY}`;

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(
			document({ body }),
		);
		const actual = result.event.agenda[0].speakers.map(({ id }) => id);

		// Assert
		expect(result.event.host?.id).toBe("host-0001");
		expect(actual).toEqual(["speaker-0001", "speaker-0002"]);
	});

	it("accepts legacy unbound metadata without applying it to name-only references", () => {
		// Arrange
		const body = `<!-- meetup-event-schema:1 -->
<!-- meetup-event-references:{"hostId":"host-0001","agendaSpeakerIds":[["speaker-0001","speaker-9998"]]} -->
${LEGACY_BODY}`;

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(
			document({ body }),
		);
		const actual = result.diagnostics.map(({ code }) => code);
		const actual1 = result.diagnostics.map(({ code }) => code);

		// Assert
		expect(result.event.host).toEqual({ displayName: "Aix Tech Hub" });
		expect(result.event.agenda[0].speakers).toEqual([
			{ displayName: "Ada Lovelace" },
			{ id: "speaker-0002", displayName: "Grace Hopper" },
		]);
		expect(actual).toContain("event.document.reference-metadata.legacy");
		expect(actual1).not.toContain("event.document.reference-metadata.invalid");
	});

	it("returns diagnostics for malformed historical content rather than crashing", () => {
		// Arrange
		const malformed = `<!-- meetup-event-schema:future -->
<!-- meetup-event-references:{invalid} -->
### Event Title

First title

### Event Title

Duplicate title

### Event Date

not-a-date

### Hoster

Some host

### Event Description

Description

### Agenda

not an agenda entry

### Post event

- malformed checkbox

### Event Status

finished
`;

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(
			document({ body: malformed }),
		);

		// Assert
		expect(result.diagnostics.map(({ code }) => code)).toEqual(
			expect.arrayContaining([
				"event.document.schema-version.unsupported",
				"event.document.reference-metadata.invalid",
				"event.document.heading.duplicate",
				"event.document.checkbox.invalid",
				"event.agenda.legacy-line-invalid",
				"event.occurrence-status.invalid",
			]),
		);
	});

	it("creates a minimal patch while preserving unmanaged body content", () => {
		// Arrange
		const source = document();

		// Act
		const patch = new GitHubIssueFormEventDocumentCodec().createPatch(
			source,
			normalizedEvent(),
		);

		// Assert
		expect(patch.issueTitle).toBe(
			"[Meetup] - 2026-11-05 - Platform Engineering Night",
		);
		expect(patch.labels).toEqual([
			"meetup",
			"hoster:confirmed",
			"speakers:confirmed",
			"event:held",
			"custom",
		]);
		expect(patch.body).toContain("Introductory text that is not managed.");
		expect(patch.body).toContain(
			"### Unmanaged Section\n\nThis exact content must survive.",
		);
		expect(patch.body).toContain("### Aperitif\n\nYes");
		expect(patch.body).toContain(CURRENT_MARKER_FOR_TEST);
		expect(patch.body).toContain(
			'<!-- meetup-event-references:{"schemaVersion":2,"host":{"id":"host-0001","displayName":"Aix Tech Hub"},"speakers":[{"id":"speaker-0001","displayName":"Ada Lovelace"},{"id":"speaker-0002","displayName":"Grace Hopper"}]} -->',
		);
		expect(patch.body).toContain("### Hoster\n\nAix Tech Hub");
		expect(patch.body).not.toContain("### Event Status");
		expect(patch.body).toContain(
			"- Ada Lovelace, Grace Hopper: Platform history",
		);
		expect(patch.body).not.toContain("private@");
	});

	it("renders resolved catalog locations with the caller repository, revision, and paths", () => {
		// Arrange
		const codec = new GitHubIssueFormEventDocumentCodec({
			repositoryRef: "catalog/update",
		});
		const source = document({
			identity: { repository: "example/events", issueNumber: 42 },
		});
		const event = normalizedEvent({
			host: {
				id: "host-0001",
				displayName: "Example Venue",
				source: { path: "catalog/venues list.csv", line: 7 },
			},
			agenda: [
				{
					speakers: [
						{
							id: "speaker-0001",
							displayName: "Example Speaker",
							source: { path: "catalog/presenters.csv", line: 12 },
						},
						{ displayName: "Unresolved Speaker" },
					],
					description: "Platform history",
				},
			],
		});

		// Act
		const patch = codec.createPatch(source, event);

		// Assert
		expect(patch.body).toContain(
			"### Hoster\n\n[Example Venue](https://github.com/example/events/blob/catalog%2Fupdate/catalog/venues%20list.csv#L7)",
		);
		expect(patch.body).toContain(
			"- [Example Speaker](https://github.com/example/events/blob/catalog%2Fupdate/catalog/presenters.csv#L12), Unresolved Speaker: Platform history",
		);
		expect(patch.body).not.toContain('"source"');
	});

	it("round-trips linked participants without losing navigation or producing another patch", () => {
		// Arrange
		const codec = new GitHubIssueFormEventDocumentCodec({
			repositoryRef: "catalog-revision",
		});
		const event = normalizedEvent({
			host: {
				id: "host-0001",
				displayName: "Example Venue",
				source: { path: "catalog/venues.csv", line: 7 },
			},
			agenda: [
				{
					speakers: [
						{
							id: "speaker-0001",
							displayName: "Example Speaker",
							source: { path: "catalog/presenters (all).csv", line: 12 },
						},
					],
					description: "Platform history",
				},
			],
		});
		const source = document();

		// Act
		const first = codec.createPatch(source, event);
		const projected = { ...source, ...first };
		const decoded = codec.decode(projected);
		const second = codec.createPatch(projected, decoded.event);

		// Assert
		expect(decoded.event.host).toEqual(event.host);
		expect(decoded.event.agenda).toEqual(event.agenda);
		expect(second).toEqual({});
	});

	it("round-trips bound reference metadata without producing another patch", () => {
		// Arrange
		const codec = new GitHubIssueFormEventDocumentCodec();
		const event = normalizedEvent();

		// Act
		const first = codec.createPatch(document(), event);
		const projectedDocument = document({
			issueTitle: first.issueTitle ?? event.issueTitle,
			labels: first.labels ?? event.labels,
			body: first.body ?? LEGACY_BODY,
		});
		const decoded = codec.decode(projectedDocument);
		const second = codec.createPatch(projectedDocument, decoded.event);

		// Assert
		expect(decoded.event.host?.id).toBe("host-0001");
		expect(decoded.event.agenda[0].speakers.map(({ id }) => id)).toEqual([
			"speaker-0001",
			"speaker-0002",
		]);
		expect(second).toEqual({});
	});

	it("keeps an edited visible host ID instead of stale bound metadata", () => {
		// Arrange
		const codec = new GitHubIssueFormEventDocumentCodec();
		const event = normalizedEvent();
		const patch = codec.createPatch(document(), event);
		const changedBody = (patch.body ?? LEGACY_BODY).replace(
			"### Hoster\n\nAix Tech Hub",
			"### Hoster\n\nNew Venue [host-9001]",
		);

		// Act
		const decoded = codec.decode(document({ body: changedBody }));
		const actual = decoded.diagnostics.map(({ code }) => code);

		// Assert
		expect(decoded.event.host).toEqual({
			displayName: "New Venue",
			id: "host-9001",
		});
		expect(actual).toContain("event.document.reference-metadata.stale");
	});

	it("does not attach a stale host ID to an edited name-only host", () => {
		// Arrange
		const codec = new GitHubIssueFormEventDocumentCodec();
		const patch = codec.createPatch(document(), normalizedEvent());
		const changedBody = (patch.body ?? LEGACY_BODY).replace(
			"### Hoster\n\nAix Tech Hub",
			"### Hoster\n\nNew Venue",
		);

		// Act
		const decoded = codec.decode(document({ body: changedBody }));

		// Assert
		expect(decoded.event.host).toEqual({ displayName: "New Venue" });
	});

	it("restores name-bound speaker IDs after reordering without binding a changed speaker", () => {
		// Arrange
		const codec = new GitHubIssueFormEventDocumentCodec();
		const patch = codec.createPatch(document(), normalizedEvent());
		const changedBody = (patch.body ?? LEGACY_BODY).replace(
			"- Ada Lovelace, Grace Hopper: Platform history",
			"- Grace Hopper, Katherine Johnson: Platform history",
		);

		// Act
		const decoded = codec.decode(document({ body: changedBody }));

		// Assert
		expect(decoded.event.agenda[0].speakers).toEqual([
			{ displayName: "Grace Hopper", id: "speaker-0002" },
			{ displayName: "Katherine Johnson" },
		]);
	});

	it("keeps edited visible speaker IDs when speakers are reordered", () => {
		// Arrange
		const codec = new GitHubIssueFormEventDocumentCodec();
		const patch = codec.createPatch(document(), normalizedEvent());
		const changedBody = (patch.body ?? LEGACY_BODY).replace(
			"- Ada Lovelace, Grace Hopper: Platform history",
			"- Grace Hopper [speaker-9002], Ada Lovelace [speaker-9001]: Platform history",
		);

		// Act
		const decoded = codec.decode(document({ body: changedBody }));

		// Assert
		expect(decoded.event.agenda[0].speakers).toEqual([
			{ displayName: "Grace Hopper", id: "speaker-9002" },
			{ displayName: "Ada Lovelace", id: "speaker-9001" },
		]);
	});

	it("adds missing managed headings only when a normalized value exists", () => {
		// Arrange
		const source = document({
			body: "Unmanaged prologue.\n\n### Event Title\n\nOld\n",
		});

		// Act
		const patch = new GitHubIssueFormEventDocumentCodec().createPatch(
			source,
			normalizedEvent({ publicationLinks: {} }),
		);

		// Assert
		expect(patch.body).toContain("Unmanaged prologue.");
		expect(patch.body).toContain("### Event Date\n\n2026-11-05");
		expect(patch.body).not.toContain("### Event Status");
		expect(patch.body).toContain(
			"### Slides & Content\n\n- [x] Basic Slides\n- [ ] Slides hoster",
		);
		expect(patch.body).toContain("### Communication\n\n- [x] Announcement");
		expect(patch.body).toContain("### Aperitif\n\nYes");
		expect(patch.body).toContain("### Restaurant / Bar\n\nNo");
		expect(patch.body).toContain("### Post event\n\n- [x] Mail thanks hoster");
		expect(patch.body).not.toContain("### Drive Link");
	});

	it("reports an invalid logistics intent without discarding other facts", () => {
		// Arrange
		const body = LEGACY_BODY.replace(
			"### Aperitif\n\nYes",
			"### Aperitif\n\nMaybe",
		);

		// Act
		const result = new GitHubIssueFormEventDocumentCodec().decode(
			document({ body }),
		);
		const patch = new GitHubIssueFormEventDocumentCodec().createPatch(
			document({ body }),
			result.event,
		);

		// Assert
		expect(result.event.logistics.aperitif).toBe("unspecified");
		expect(result.event.logistics.postEventVenue).toBe("not-planned");
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "event.logistics.intent.invalid",
				field: "Aperitif",
				severity: "error",
			}),
		);
		expect(patch.body).toContain("### Aperitif\n\nMaybe");
	});

	it("uses configured confirmation labels and time zone", () => {
		// Arrange
		// No additional setup is needed.

		// Act
		const result = new GitHubIssueFormEventDocumentCodec({
			timeZone: "UTC",
			hostConfirmationLabel: "host:approved",
			speakersConfirmationLabel: "speakers:approved",
		}).decode(document({ labels: ["host:approved", "speakers:approved"] }));

		// Assert
		expect(result.event.timeZone).toBe("UTC");
		expect(result.event.confirmations).toEqual({
			host: true,
			speakers: true,
		});
	});
});

const CURRENT_MARKER_FOR_TEST = "<!-- meetup-event-schema:1 -->";

it("round-trips feedback links while preserving unmanaged issue content", () => {
	// Arrange
	const codec = new GitHubIssueFormEventDocumentCodec();
	const source = document();
	const event = normalizedEvent({
		publicationLinks: { feedback: "https://openfeedback.io/example-poll" },
	});

	// Act
	const patch = codec.createPatch(source, event);
	const projected = { ...source, ...patch };
	const decoded = codec.decode(projected);
	const repeated = codec.createPatch(projected, decoded.event);

	// Assert
	expect(decoded.event.publicationLinks.feedback).toBe(
		"https://openfeedback.io/example-poll",
	);
	expect(patch.body).toContain("### OpenFeedback Link");
	expect(patch.body).toContain("This exact content must survive.");
	expect(repeated).toEqual({});
});
