import type {
	EventDocument,
	MeetupEvent,
	ReconcileEventDependencies,
} from "@meetup-automation/event";
import type { AssetRepository } from "@meetup-automation/publication";
import type { RawReferentialCatalog } from "@meetup-automation/referential";
import { describe, expect, it, vi } from "vitest";
import type { AutomationConfig } from "../src/index.js";
import { ManageMeetupAssets, ManageMeetupEvent } from "../src/index.js";

const identity = {
	repository: "cloud-native-aixmarseille/meetups",
	issueNumber: 42,
} as const;

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

const sourceDocument: EventDocument = {
	identity,
	issueState: "open",
	issueTitle: "[Meetup] - 2026-09-30 - Cloud Native Evening",
	labels: ["meetup", "hoster:confirmed", "speakers:confirmed"],
	body: "synthetic event document",
};

const event: MeetupEvent = {
	schemaVersion: 1,
	identity,
	issueState: "open",
	issueTitle: sourceDocument.issueTitle,
	labels: sourceDocument.labels,
	eventTitle: "Cloud Native Evening",
	date: "2026-09-30",
	description: "An evening about cloud-native technology",
	host: { id: "host-0001", displayName: "Example Host" },
	agenda: [
		{
			speakers: [{ id: "speaker-0001", displayName: "Example Speaker" }],
			description: "Reliable platforms",
		},
	],
	publicationLinks: {
		meetup:
			"https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
		community:
			"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/cloud-native-evening",
		assets: "https://drive.google.com/drive/folders/folder-1",
	},
	occurrenceStatus: "held",
	timeZone: "Europe/Paris",
	confirmations: { host: true, speakers: true },
	logistics: {
		aperitif: "planned",
		postEventVenue: "not-planned",
	},
	operationalChecklists: {
		slidesAndContent: [],
		communication: [],
		postEvent: [
			{ name: "Mail thanks hoster", completed: true },
			{ name: "Mail thanks speakers", completed: true },
			{ name: "Share slides to meetup", completed: true },
			{
				name: "Sync attendees from tally sheet to CNCF",
				completed: false,
			},
			{ name: "Social networks", completed: false },
		],
	},
	followUpComplete: false,
};

const catalog: RawReferentialCatalog = {
	hosts: [
		{
			hostId: "host-0001",
			displayName: "Example Host",
			contactId: "contact-0001",
			contactName: "Synthetic Contact",
			email: "contact@example.test",
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

describe("ManageMeetupEvent manual publication tasks", () => {
	it("returns composed task status and diagnoses only pending manual work", async () => {
		const eventDependencies = createEventDependencies();
		const useCase = new ManageMeetupEvent({
			configRepository: { load: vi.fn().mockResolvedValue(config) },
			createReferentialRepository: () => ({
				load: vi.fn().mockResolvedValue(catalog),
			}),
			createEventDependencies: () => eventDependencies,
		});

		const result = await useCase.execute({
			configPath: ".github/meetup-automation.yml",
			identity,
			mode: "check",
		});

		expect(result.skipped).toBe(false);
		if (result.skipped) {
			throw new Error("Expected the meetup event to be managed");
		}

		expect(result.manualPublicationTasks).toEqual([
			expect.objectContaining({
				kind: "publish-meetup-event",
				status: "completed",
			}),
			expect.objectContaining({
				kind: "publish-community-event",
				status: "completed",
			}),
			expect.objectContaining({
				kind: "create-asset-folder",
				status: "completed",
			}),
			expect.objectContaining({
				kind: "publish-slides",
				status: "completed",
			}),
			expect.objectContaining({
				kind: "import-attendance",
				status: "pending",
			}),
		]);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "publication.manual-task.import-attendance.pending",
				severity: "info",
			}),
		);
		expect(result.diagnostics.map(({ code }) => code)).not.toContain(
			"publication.manual-task.publish-slides.pending",
		);
	});
});

function createEventDependencies(): ReconcileEventDependencies {
	return {
		repository: {
			find: vi.fn().mockResolvedValue(sourceDocument),
			applyPatch: vi.fn().mockResolvedValue(undefined),
			listPage: vi.fn(),
		},
		documentCodec: {
			decode: vi.fn().mockReturnValue({ event, diagnostics: [] }),
			createPatch: vi.fn().mockReturnValue({}),
		},
		commentRepository: {
			reconcileDiagnostics: vi.fn().mockResolvedValue({ changed: false }),
		},
		clock: { now: () => "2026-10-01T10:00:00Z" },
	};
}

function assetJourney() {
	const eventDependencies = createEventDependencies();
	const assetRepository = {
		findContainer: vi
			.fn<AssetRepository["findContainer"]>()
			.mockResolvedValue(undefined),
		ensureContainer: vi
			.fn<AssetRepository["ensureContainer"]>()
			.mockResolvedValue({
				id: "new-folder",
				name: "2026-09-30 - September - Example Host",
				url: "https://drive.google.com/drive/folders/new-folder",
				eventId: `${identity.repository}#42`,
			}),
		listTemplates: vi.fn<AssetRepository["listTemplates"]>().mockResolvedValue([
			{
				id: "template",
				name: "[EVENT_DATE:YYYY-MM-DD] Slides",
				kind: "slides",
			},
		]),
		listFiles: vi.fn<AssetRepository["listFiles"]>().mockResolvedValue([]),
		copyTemplate: vi.fn<AssetRepository["copyTemplate"]>().mockResolvedValue({
			id: "copy",
			name: "2026-09-30 Slides",
			url: "https://docs.google.com/presentation/d/copy",
		}),
		updateFile: vi.fn<AssetRepository["updateFile"]>(),
	};
	const useCase = new ManageMeetupAssets({
		configRepository: { load: async () => config },
		createReferentialRepository: () => ({ load: async () => catalog }),
		createEventDependencies: () => eventDependencies,
		assetRepository,
	});
	return { eventDependencies, assetRepository, useCase };
}

describe("ManageMeetupAssets", () => {
	it("projects the managed asset link through the codec and exposes template links", async () => {
		const { eventDependencies, assetRepository, useCase } = assetJourney();
		vi.mocked(eventDependencies.documentCodec.createPatch).mockReturnValue({
			body: "projected asset link",
		});
		const result = await useCase.execute({
			configPath: "",
			identity,
			mode: "fix",
		});
		expect(result).toMatchObject({
			skipped: false,
			persisted: true,
			assetUrl: "https://drive.google.com/drive/folders/new-folder",
			files: { "slides-link": "https://docs.google.com/presentation/d/copy" },
		});
		expect(assetRepository.ensureContainer).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: `${identity.repository}#42`,
				title: "2026-09-30 - September - Example Host",
			}),
		);
		expect(
			eventDependencies.documentCodec.createPatch,
		).toHaveBeenLastCalledWith(sourceDocument, {
			...event,
			publicationLinks: { ...event.publicationLinks, assets: result.assetUrl },
		});
		expect(eventDependencies.repository.applyPatch).toHaveBeenCalledOnce();
		expect(
			eventDependencies.commentRepository.reconcileDiagnostics,
		).not.toHaveBeenCalled();
	});

	it("checks existing assets without updating the issue or remote files", async () => {
		const { eventDependencies, assetRepository, useCase } = assetJourney();
		const result = await useCase.execute({
			configPath: "",
			identity,
			mode: "check",
		});
		expect(result.persisted).toBe(false);
		expect(assetRepository.ensureContainer).not.toHaveBeenCalled();
		expect(eventDependencies.repository.applyPatch).not.toHaveBeenCalled();
		expect(
			eventDependencies.commentRepository.reconcileDiagnostics,
		).not.toHaveBeenCalled();
	});

	it("does not persist an empty codec patch", async () => {
		const { eventDependencies, useCase } = assetJourney();
		expect(
			(await useCase.execute({ configPath: "", identity, mode: "fix" }))
				.persisted,
		).toBe(false);
		expect(eventDependencies.repository.applyPatch).not.toHaveBeenCalled();
	});

	it.each([
		"unrelated",
		"cancelled",
		"unresolved-host",
		"invalid-date",
	])("skips asset writes for %s events", async (scenario) => {
		const { eventDependencies, assetRepository, useCase } = assetJourney();
		if (scenario === "unrelated")
			vi.mocked(eventDependencies.repository.find).mockResolvedValue({
				...sourceDocument,
				labels: [],
			});
		else
			vi.mocked(eventDependencies.documentCodec.decode).mockReturnValue({
				event: {
					...event,
					...(scenario === "cancelled"
						? {
								occurrenceStatus: "cancelled",
								labels: [...event.labels, "event:cancelled"],
							}
						: scenario === "unresolved-host"
							? { host: { displayName: "Unknown" } }
							: { date: "invalid" }),
				},
				diagnostics: [],
			});
		const result = await useCase.execute({
			configPath: "",
			identity,
			mode: "fix",
		});
		expect(result.persisted).toBe(false);
		expect(assetRepository.ensureContainer).not.toHaveBeenCalled();
	});

	it("fails when the issue cannot be found", async () => {
		const { eventDependencies, useCase } = assetJourney();
		vi.mocked(eventDependencies.repository.find).mockResolvedValue(null);
		await expect(
			useCase.execute({ configPath: "", identity, mode: "fix" }),
		).rejects.toThrow("not found");
	});

	it("detects an issue edit before contacting Drive", async () => {
		const { eventDependencies, assetRepository, useCase } = assetJourney();
		vi.mocked(eventDependencies.repository.find)
			.mockResolvedValueOnce(sourceDocument)
			.mockResolvedValue({ ...sourceDocument, body: "concurrent human edit" });
		await expect(
			useCase.execute({ configPath: "", identity, mode: "fix" }),
		).rejects.toMatchObject({ name: "EventConcurrentModificationError" });
		expect(assetRepository.listTemplates).not.toHaveBeenCalled();
	});

	it("preserves a human edit made while assets were being reconciled", async () => {
		const { eventDependencies, useCase } = assetJourney();
		vi.mocked(eventDependencies.documentCodec.createPatch).mockReturnValue({
			body: "projected asset link",
		});
		vi.mocked(eventDependencies.repository.find)
			.mockResolvedValueOnce(sourceDocument)
			.mockResolvedValueOnce(sourceDocument)
			.mockResolvedValue({ ...sourceDocument, body: "concurrent human edit" });
		await expect(
			useCase.execute({ configPath: "", identity, mode: "fix" }),
		).rejects.toMatchObject({ name: "EventConcurrentModificationError" });
		expect(eventDependencies.repository.applyPatch).not.toHaveBeenCalled();
	});
});
