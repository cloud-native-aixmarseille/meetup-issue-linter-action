import { describe, expect, it, vi } from "vitest";
import {
	type AssetRepository,
	type AssetTemplate,
	ReconcileEventAssets,
} from "../src/index.js";

const input = {
	eventId: "community/meetups#42",
	legacyEventId: "42",
	date: "2026-09-30",
	hostName: "Example Host",
	mode: "fix" as const,
};
const folder = {
	id: "folder-1",
	url: "https://drive.google.com/drive/folders/folder-1",
	name: "2026-09-30 - September - Example Host",
	eventId: input.eventId,
};
const template = {
	id: "template-1",
	name: "[EVENT_DATE:YYYY-MM-DD] - Slides",
	kind: "slides",
};
const file = {
	id: "file-1",
	name: "2026-09-30 - Slides",
	templateId: template.id,
	kind: "slides",
	url: "https://docs.google.com/presentation/d/file-1",
};

function setup() {
	const repository = {
		findContainer: vi
			.fn<AssetRepository["findContainer"]>()
			.mockResolvedValue(folder),
		ensureContainer: vi
			.fn<AssetRepository["ensureContainer"]>()
			.mockResolvedValue(folder),
		listTemplates: vi
			.fn<AssetRepository["listTemplates"]>()
			.mockResolvedValue([template]),
		listFiles: vi.fn<AssetRepository["listFiles"]>().mockResolvedValue([file]),
		copyTemplate: vi
			.fn<AssetRepository["copyTemplate"]>()
			.mockResolvedValue(file),
		updateFile: vi.fn<AssetRepository["updateFile"]>().mockResolvedValue(file),
	};
	return { repository, reconcile: new ReconcileEventAssets(repository) };
}

describe("event asset reconciliation", () => {
	it("creates the missing folder and template copies and returns typed links", async () => {
		const { repository, reconcile } = setup();
		repository.findContainer.mockResolvedValue(undefined);
		repository.listFiles.mockResolvedValue([]);
		const result = await reconcile.execute(input);
		expect(repository.ensureContainer).toHaveBeenCalledWith(
			expect.objectContaining({
				title: folder.name,
				idempotencyKey: "community/meetups#42:assets:v1",
				legacyEventId: "42",
			}),
		);
		expect(repository.copyTemplate).toHaveBeenCalledWith(
			folder.id,
			template,
			file.name,
		);
		expect(result.files).toEqual({ "slides-link": file.url });
		expect(result.diagnostics.every((item) => item.fixApplied)).toBe(true);
	});

	it("performs no writes when the existing folder and files already match", async () => {
		const { repository, reconcile } = setup();
		const result = await reconcile.execute({
			...input,
			existingUrl: folder.url,
		});
		expect(result.diagnostics).toEqual([]);
		expect(repository.ensureContainer).not.toHaveBeenCalled();
		expect(repository.copyTemplate).not.toHaveBeenCalled();
		expect(repository.updateFile).not.toHaveBeenCalled();
	});

	it("reports missing folders in check mode without any mutation", async () => {
		const { repository, reconcile } = setup();
		repository.findContainer.mockResolvedValue(undefined);
		const result = await reconcile.execute({ ...input, mode: "check" });
		expect(result.container).toBeUndefined();
		expect(result.diagnostics).toMatchObject([
			{ code: "publication.assets.container.drift", fixApplied: false },
		]);
		expect(repository.ensureContainer).not.toHaveBeenCalled();
		expect(repository.listFiles).not.toHaveBeenCalled();
	});

	it("checks folder, link, and file drift without writing", async () => {
		const { repository, reconcile } = setup();
		repository.findContainer.mockResolvedValue({
			...folder,
			name: "Old folder",
			eventId: undefined,
		});
		repository.listFiles.mockResolvedValue([
			{ ...file, name: "Old slides", kind: undefined },
		]);
		const result = await reconcile.execute({ ...input, mode: "check" });
		expect(result.diagnostics.map(({ code }) => code)).toEqual([
			"publication.assets.container.drift",
			"publication.assets.link.drift",
			"publication.assets.file.drift",
		]);
		expect(repository.ensureContainer).not.toHaveBeenCalled();
		expect(repository.updateFile).not.toHaveBeenCalled();
		expect(repository.copyTemplate).not.toHaveBeenCalled();
	});

	it("renames folders and adopts legacy copies without duplicating them", async () => {
		const { repository, reconcile } = setup();
		repository.findContainer.mockResolvedValue({
			...folder,
			name: "Old name",
			eventId: undefined,
		});
		repository.listFiles.mockResolvedValue([
			{ ...file, templateId: undefined, kind: undefined },
		]);
		await reconcile.execute(input);
		expect(repository.ensureContainer).toHaveBeenCalledOnce();
		expect(repository.updateFile).toHaveBeenCalledWith(
			expect.objectContaining({ id: file.id }),
			template,
			file.name,
		);
		expect(repository.copyTemplate).not.toHaveBeenCalled();
	});

	it("finds renamed copies by template ID and tolerates files without a URL", async () => {
		const { repository, reconcile } = setup();
		repository.listFiles.mockResolvedValue([{ ...file, name: "Old name" }]);
		repository.updateFile.mockResolvedValue({ ...file, url: undefined });
		expect((await reconcile.execute(input)).files).toEqual({});
		expect(repository.updateFile).toHaveBeenCalledOnce();
	});

	it.each(["", "invalid", "2026-02-30", "2026-13-01"])(
		"does not contact the asset repository for invalid date %s",
		async (date) => {
			const { repository, reconcile } = setup();
			expect(
				(await reconcile.execute({ ...input, date })).diagnostics[0].code,
			).toBe("publication.assets.prerequisites");
			expect(repository.listTemplates).not.toHaveBeenCalled();
		},
	);

	it("requires a host and uses civil date month names independently of runtime timezone", async () => {
		const { repository, reconcile } = setup();
		await reconcile.execute({ ...input, hostName: " " });
		expect(repository.listTemplates).not.toHaveBeenCalled();
		repository.findContainer.mockResolvedValue(undefined);
		await reconcile.execute({
			...input,
			date: "2026-03-01",
			hostName: " Example Host ",
		});
		expect(repository.ensureContainer).toHaveBeenCalledWith(
			expect.objectContaining({ title: "2026-03-01 - March - Example Host" }),
		);
	});

	it.each<readonly AssetTemplate[]>([
		[],
		[{ ...template, kind: "" }],
		[template, template],
		[template, { ...template, id: "template-2" }],
	])(
		"rejects invalid template catalogs before any mutation",
		async (...templates) => {
			const { repository, reconcile } = setup();
			repository.listTemplates.mockResolvedValue(templates);
			await expect(reconcile.execute(input)).rejects.toThrow("Asset templates");
			expect(repository.ensureContainer).not.toHaveBeenCalled();
		},
	);

	it.each([true, false])(
		"rejects ambiguous matching copies (tagged: %s)",
		async (tagged) => {
			const { repository, reconcile } = setup();
			const duplicate = {
				...file,
				templateId: tagged ? file.templateId : undefined,
			};
			repository.listFiles.mockResolvedValue([
				duplicate,
				{ ...duplicate, id: "duplicate" },
			]);
			await expect(reconcile.execute(input)).rejects.toThrow("Ambiguous");
			expect(repository.updateFile).not.toHaveBeenCalled();
			expect(repository.copyTemplate).not.toHaveBeenCalled();
		},
	);
});
