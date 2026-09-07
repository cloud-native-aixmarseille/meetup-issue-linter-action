import { describe, expect, it, vi } from "vitest";
import {
	type AutomationConfig,
	ManageMeetupEvent,
	SynchronizeMeetupIssueForm,
	ValidateMeetupReferentials,
} from "../packages/application/journey/src/index.js";
import type {
	EventDocument,
	ReconcileEventDependencies,
} from "../packages/domain/event/src/index.js";
import type {
	RawReferentialCatalog,
	ReferentialRepository,
} from "../packages/domain/referential/src/index.js";

const config: AutomationConfig = {
	"schema-version": 1,
	timezone: "Europe/Paris",
	event: {
		"issue-label": "meetup",
		"issue-form": ".github/ISSUE_TEMPLATE/meetup.yml",
		"occurrence-status-field": "event_status",
		"required-confirmation-labels": ["hoster:confirmed", "speakers:confirmed"],
	},
	referentials: {
		hosts: "referentials/hosting.csv",
		speakers: "referentials/speakers.csv",
	},
	communication: {
		"readiness-window-days": 7,
		"mailings-repository": "cloud-native-aixmarseille/mailings",
		"slack-enabled": true,
		"approval-label": "communication:approved",
		"dispatch-enabled": false,
		"policy-version": 1,
	},
	publication: {
		"meetup-event-url-prefix":
			"https://www.meetup.com/cloud-native-aix-marseille/events/",
		"cncf-event-url-prefix":
			"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/",
	},
};

const catalog: RawReferentialCatalog = {
	hosts: [
		{
			hostId: "host-0001",
			displayName: "Example Host",
			contactId: "contact-0001",
			contactName: "Synthetic Contact",
			email: "host@example.test",
			address: "Synthetic address",
		},
	],
	speakers: [
		{
			speakerId: "speaker-0001",
			firstName: "Example",
			lastName: "Speaker",
			company: "Example Company",
			email: "speaker@example.test",
		},
	],
};

const dependenciesFor = (rawCatalog: RawReferentialCatalog) => {
	const loadConfig = vi.fn().mockResolvedValue(config);
	const loadCatalog = vi.fn().mockResolvedValue(rawCatalog);
	const createReferentialRepository = vi
		.fn<(value: AutomationConfig) => ReferentialRepository>()
		.mockReturnValue({ load: loadCatalog });

	return {
		dependencies: {
			configRepository: { load: loadConfig },
			createReferentialRepository,
		},
		loadCatalog,
		loadConfig,
		createReferentialRepository,
	};
};

describe("referential journey orchestration", () => {
	it("loads configuration before validating and redacts catalog diagnostics", async () => {
		const fixture = dependenciesFor(catalog);
		const result = await new ValidateMeetupReferentials(
			fixture.dependencies,
		).execute(".github/meetup-automation.yml");

		expect(result.isValid).toBe(true);
		if (!result.isValid) throw new Error("Expected a valid synthetic catalog");
		expect(result.config).toBe(config);
		expect(result.catalog.hosts).toHaveLength(1);
		expect(result.catalog.speakers).toHaveLength(1);
		expect(result.diagnostics).toEqual([]);
		expect(fixture.loadConfig).toHaveBeenCalledWith(
			".github/meetup-automation.yml",
		);
		expect(fixture.createReferentialRepository).toHaveBeenCalledWith(config);
		expect(fixture.loadCatalog).toHaveBeenCalledOnce();
	});

	it("stops issue-form projection when a catalog is invalid", async () => {
		const fixture = dependenciesFor({
			...catalog,
			speakers: [{ ...catalog.speakers[0], email: "not-an-email" }],
		});
		const synchronize = vi.fn();
		const result = await new SynchronizeMeetupIssueForm({
			...fixture.dependencies,
			issueFormProjection: { synchronize },
		}).execute({ configPath: ".github/meetup-automation.yml", mode: "check" });

		expect(result.changed).toBe(false);
		expect(result.changedFiles).toEqual([]);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "referential.speaker.email.invalid",
				severity: "error",
			}),
		);
		expect(synchronize).not.toHaveBeenCalled();
	});

	it("projects a validated catalog with the configured field contract", async () => {
		const fixture = dependenciesFor(catalog);
		const synchronize = vi.fn().mockResolvedValue({
			changed: true,
			changedFiles: [config.event["issue-form"]],
			diagnostics: [
				{
					code: "issue-form.projection.stale",
					severity: "warning",
					message: "The public projection is stale.",
				},
			],
		});
		const result = await new SynchronizeMeetupIssueForm({
			...fixture.dependencies,
			issueFormProjection: { synchronize },
		}).execute({ configPath: ".github/meetup-automation.yml", mode: "fix" });

		expect(result).toEqual({
			changed: true,
			changedFiles: [config.event["issue-form"]],
			diagnostics: [
				{
					code: "issue-form.projection.stale",
					severity: "warning",
					message: "The public projection is stale.",
				},
			],
		});
		expect(synchronize).toHaveBeenCalledWith({
			issueFormPath: config.event["issue-form"],
			occurrenceStatusFieldId: config.event["occurrence-status-field"],
			catalog: expect.objectContaining({
				hosts: expect.any(Array),
				speakers: expect.any(Array),
			}),
			mode: "fix",
		});
	});
});

describe("event journey selection", () => {
	const identity = {
		repository: "cloud-native-aixmarseille/meetups",
		issueNumber: 42,
	} as const;

	const eventDependencies = (
		document: EventDocument | undefined,
	): ReconcileEventDependencies => ({
		repository: {
			find: vi.fn().mockResolvedValue(document),
			applyPatch: vi.fn(),
			listPage: vi.fn(),
		},
		documentCodec: {
			decode: vi.fn(),
			createPatch: vi.fn(),
		},
		commentRepository: { reconcileDiagnostics: vi.fn() },
		clock: { now: () => "2026-09-04T10:00:00Z" },
	});

	it("fails explicitly when the requested issue no longer exists", async () => {
		const useCase = new ManageMeetupEvent({
			configRepository: { load: vi.fn().mockResolvedValue(config) },
			createReferentialRepository: () => ({
				load: vi.fn().mockResolvedValue(catalog),
			}),
			createEventDependencies: () => eventDependencies(undefined),
		});

		await expect(
			useCase.execute({
				configPath: ".github/meetup-automation.yml",
				identity,
				mode: "check",
			}),
		).rejects.toThrow(
			"Meetup event cloud-native-aixmarseille/meetups#42 was not found",
		);
	});

	it("skips issues outside the configured meetup label", async () => {
		const document: EventDocument = {
			identity,
			issueState: "open",
			issueTitle: "A regular repository issue",
			labels: ["question"],
			body: "This is intentionally not a meetup.",
		};
		const useCase = new ManageMeetupEvent({
			configRepository: { load: vi.fn().mockResolvedValue(config) },
			createReferentialRepository: () => ({
				load: vi.fn().mockResolvedValue(catalog),
			}),
			createEventDependencies: () => eventDependencies(document),
		});

		await expect(
			useCase.execute({
				configPath: ".github/meetup-automation.yml",
				identity,
				mode: "fix",
			}),
		).resolves.toEqual({ skipped: true, diagnostics: [] });
	});
});
