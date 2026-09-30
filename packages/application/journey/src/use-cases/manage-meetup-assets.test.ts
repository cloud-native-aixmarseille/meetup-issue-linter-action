import {
	type AssetRepository,
	ReconcileEventAssets,
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
import { ManageMeetupAssets } from "./manage-meetup-assets.js";
import { ManageMeetupEvent } from "./manage-meetup-event.js";

describe("ManageMeetupAssets", () => {
	it("projects the managed asset link through the codec and exposes template links", async () => {
		// Arrange
		const { eventDependencies, assetRepository, useCase } = assetJourney();
		vi.mocked(eventDependencies.documentCodec.createPatch).mockReturnValue({
			body: "projected asset link",
		});

		// Act
		const result = await useCase.execute({
			identity,
		});

		// Assert
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

	it("does not persist an empty codec patch", async () => {
		// Arrange
		const { eventDependencies, useCase } = assetJourney();

		// Act
		const persisted = (await useCase.execute({ identity })).persisted;

		// Assert
		expect(persisted).toBe(false);
		expect(eventDependencies.repository.applyPatch).not.toHaveBeenCalled();
	});

	it.each(["unrelated", "cancelled", "unresolved-host", "invalid-date"])(
		"skips asset writes for %s events",
		async (scenario) => {
			// Arrange
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

			// Act
			const result = await useCase.execute({
				identity,
			});

			// Assert
			expect(result.persisted).toBe(false);
			expect(assetRepository.ensureContainer).not.toHaveBeenCalled();
		},
	);

	it("fails when the issue cannot be found", async () => {
		// Arrange
		const { eventDependencies, useCase } = assetJourney();
		vi.mocked(eventDependencies.repository.find).mockResolvedValue(null);

		// Act
		const operation = useCase.execute({ identity });

		// Assert
		await expect(operation).rejects.toThrow("not found");
	});

	it("detects an issue edit before contacting Drive", async () => {
		// Arrange
		const { eventDependencies, assetRepository, useCase } = assetJourney();
		vi.mocked(eventDependencies.repository.find)
			.mockResolvedValueOnce(sourceDocument)
			.mockResolvedValue({ ...sourceDocument, body: "concurrent human edit" });

		// Act
		const operation = useCase.execute({ identity });

		// Assert
		await expect(operation).rejects.toMatchObject({
			name: "EventConcurrentModificationError",
		});
		expect(assetRepository.listTemplates).not.toHaveBeenCalled();
	});

	it("preserves a human edit made while assets were being reconciled", async () => {
		// Arrange
		const { eventDependencies, useCase } = assetJourney();
		vi.mocked(eventDependencies.documentCodec.createPatch).mockReturnValue({
			body: "projected asset link",
		});
		vi.mocked(eventDependencies.repository.find)
			.mockResolvedValueOnce(sourceDocument)
			.mockResolvedValueOnce(sourceDocument)
			.mockResolvedValue({ ...sourceDocument, body: "concurrent human edit" });

		// Act
		const operation = useCase.execute({ identity });

		// Assert
		await expect(operation).rejects.toMatchObject({
			name: "EventConcurrentModificationError",
		});
		expect(eventDependencies.repository.applyPatch).not.toHaveBeenCalled();
	});
});

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
		eventRepository: eventDependencies.repository,
		documentCodec: eventDependencies.documentCodec,
		manageEvent: new ManageMeetupEvent({
			config,
			eventDependencies,
			referentialRepository: { load: async () => catalog },
		}),
		reconcileAssets: new ReconcileEventAssets(assetRepository),
	});
	return { eventDependencies, assetRepository, useCase };
}
