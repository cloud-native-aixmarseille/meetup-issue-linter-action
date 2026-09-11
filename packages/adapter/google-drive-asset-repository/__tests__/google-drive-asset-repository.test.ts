import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	createGoogleDriveAssetRepository,
	GoogleDriveAssetRepository,
	type GoogleDriveClient,
} from "../src/index.js";

const options = { parentFolderId: "parent", templateFolderId: "templates" };
const request = {
	eventId: "community/meetups#42",
	title: "2026-09-30 - September - Example Host",
	idempotencyKey: "community/meetups#42:assets:v1",
};
const eventKey = createHash("sha256")
	.update(request.idempotencyKey)
	.digest("hex");
const folder = {
	id: "folder-1",
	name: request.title,
	mimeType: "application/vnd.google-apps.folder",
	parents: [options.parentFolderId],
	appProperties: { meetup_event_key: eventKey },
};
const template = { id: "template-1", name: "Slides", kind: "slides" };
const file = {
	id: "file-1",
	name: "Slides",
	webViewLink: "https://docs.google.com/presentation/d/file-1",
	appProperties: {
		template_file_id: template.id,
		template_kind: template.kind,
	},
};

function setup() {
	const files = {
		list: vi.fn().mockResolvedValue({ data: { files: [] } }),
		create: vi.fn().mockResolvedValue({ data: folder }),
		update: vi.fn().mockResolvedValue({ data: folder }),
		copy: vi.fn().mockResolvedValue({ data: file }),
	};
	const repository = new GoogleDriveAssetRepository(
		{ files } as unknown as GoogleDriveClient,
		options,
	);
	return { files, repository };
}

describe("Google Drive asset repository", () => {
	it("paginates all template files including empty pages", async () => {
		const { files, repository } = setup();
		files.list
			.mockResolvedValueOnce({ data: { files: [], nextPageToken: "page-2" } })
			.mockResolvedValueOnce({
				data: { files: [{ ...file, id: template.id }] },
			});
		expect(await repository.listTemplates()).toEqual([{ ...template }]);
		expect(files.list.mock.calls[1][0]).toMatchObject({
			pageToken: "page-2",
			supportsAllDrives: true,
			includeItemsFromAllDrives: true,
		});
	});

	it("looks up stable event metadata and returns vendor-independent values", async () => {
		const { files, repository } = setup();
		files.list.mockResolvedValue({ data: { files: [folder] } });
		expect(await repository.findContainer(request)).toEqual({
			id: folder.id,
			name: folder.name,
			url: "https://drive.google.com/drive/folders/folder-1",
			eventId: request.eventId,
		});
		expect(files.list.mock.calls[0][0].q).toContain(eventKey);
		expect(files.list.mock.calls[0][0].q).toContain("'parent' in parents");
		await repository.ensureContainer(request);
		expect(files.update).not.toHaveBeenCalled();
		expect(files.create).not.toHaveBeenCalled();
	});

	it("creates a tagged folder and disables automatic replay of writes", async () => {
		const { files, repository } = setup();
		await repository.ensureContainer(request);
		expect(files.create).toHaveBeenCalledWith(
			expect.objectContaining({
				requestBody: {
					name: request.title,
					mimeType: folder.mimeType,
					parents: ["parent"],
					appProperties: folder.appProperties,
				},
				supportsAllDrives: true,
			}),
			expect.objectContaining({ retry: false }),
		);
	});

	it("renames a folder identified by the event key without creating another", async () => {
		const { files, repository } = setup();
		files.list.mockResolvedValue({
			data: {
				files: [{ ...folder, name: "Previous name" }],
			},
		});
		await repository.ensureContainer(request);
		expect(files.update).toHaveBeenCalledWith(
			expect.objectContaining({
				fileId: folder.id,
				requestBody: {
					name: request.title,
					appProperties: folder.appProperties,
				},
			}),
			expect.anything(),
		);
		expect(files.create).not.toHaveBeenCalled();
	});

	it.each([
		{ parents: ["outside-parent"] },
		{ mimeType: "application/pdf" },
		{ trashed: true },
		{ appProperties: { meetup_event_key: "another-event" } },
		{ appProperties: {} },
		{ appProperties: undefined },
	])("rejects folders that do not match the requested event and parent: %j", async (override) => {
		const { files, repository } = setup();
		files.list.mockResolvedValue({
			data: { files: [{ ...folder, ...override }] },
		});
		await expect(repository.ensureContainer(request)).rejects.toThrow(
			"does not match the requested event and configured parent",
		);
		expect(files.create).not.toHaveBeenCalled();
		expect(files.update).not.toHaveBeenCalled();
	});

	it("keeps event keys distinct across repositories with the same issue number", async () => {
		const { files, repository } = setup();
		await repository.findContainer(request);
		await repository.findContainer({
			...request,
			eventId: "another/meetups#42",
			idempotencyKey: "another/meetups#42:assets:v1",
		});
		expect(files.list.mock.calls[0][0].q).not.toBe(
			files.list.mock.calls[1][0].q,
		);
	});

	it("rejects duplicate folders instead of selecting the first result", async () => {
		const { files, repository } = setup();
		files.list.mockResolvedValue({
			data: { files: [folder, { ...folder, id: "duplicate" }] },
		});
		await expect(repository.ensureContainer(request)).rejects.toThrow(
			"Multiple asset folders",
		);
		expect(files.update).not.toHaveBeenCalled();
	});

	it("copies templates and updates their names and metadata", async () => {
		const { files, repository } = setup();
		files.update.mockResolvedValue({ data: file });
		const copy = await repository.copyTemplate(folder.id, template, file.name);
		expect(copy).toEqual({
			id: file.id,
			name: file.name,
			url: file.webViewLink,
			templateId: template.id,
			kind: template.kind,
		});
		await repository.updateFile(copy, template, "Updated slides");
		expect(files.copy).toHaveBeenCalledWith(
			expect.objectContaining({
				fileId: template.id,
				requestBody: {
					name: file.name,
					parents: [folder.id],
					appProperties: file.appProperties,
				},
				supportsAllDrives: true,
			}),
			expect.objectContaining({ retry: false }),
		);
		expect(files.update.mock.calls[0][0].requestBody).toEqual({
			name: "Updated slides",
			appProperties: file.appProperties,
		});
	});

	it("escapes search terms and tolerates absent optional file metadata", async () => {
		const { files, repository } = setup();
		files.list.mockResolvedValue({
			data: { files: [{ id: "file", name: "Name" }] },
		});
		expect(await repository.listFiles("folder'\\id")).toEqual([
			{ id: "file", name: "Name", kind: undefined, templateId: undefined },
		]);
		expect(files.list.mock.calls[0][0].q).toContain(
			"'folder\\'\\\\id' in parents",
		);
	});

	it.each([
		{ incompleteSearch: true },
		{ nextPageToken: "repeated" },
	])("rejects incomplete or looping paginated responses: %j", async (data) => {
		const { files, repository } = setup();
		files.list.mockResolvedValue({ data });
		await expect(repository.listFiles("folder")).rejects.toThrow(
			/incomplete search|repeated pagination/,
		);
	});

	it.each([
		{},
		{ id: "file" },
		{ id: "file", name: "Name" },
		{ ...file, mimeType: folder.mimeType },
	])("rejects malformed templates: %j", async (badFile) => {
		const { files, repository } = setup();
		files.list.mockResolvedValue({ data: { files: [badFile] } });
		await expect(repository.listTemplates()).rejects.toThrow(
			"Every asset template",
		);
	});

	it("rejects malformed file and folder responses", async () => {
		const { files, repository } = setup();
		files.list.mockResolvedValueOnce({ data: { files: [{}] } });
		await expect(repository.listFiles("folder")).rejects.toThrow(
			"invalid asset file",
		);
		files.create.mockResolvedValue({ data: {} });
		await expect(repository.ensureContainer(request)).rejects.toThrow(
			"invalid asset folder",
		);
	});

	it.each([
		401,
		403,
		429,
		500,
		undefined,
	])("redacts provider responses and does not retry HTTP %s", async (status) => {
		const { files, repository } = setup();
		files.create.mockRejectedValue({
			response: { status, data: "private@example.test" },
			message: "secret-token",
		});
		await expect(repository.ensureContainer(request)).rejects.toMatchObject({
			name: "GoogleDriveAssetRepositoryError",
			message: expect.not.stringMatching(/private@example.test|secret-token/),
		});
		expect(files.create).toHaveBeenCalledOnce();
	});

	it.each([
		"not json",
		"null",
		"{}",
		'{"type":"external_account"}',
	])("rejects unsupported credentials without exposing them: %s", (credentials) => {
		expect(() =>
			createGoogleDriveAssetRepository(credentials, options),
		).toThrow("Invalid Google service-account credentials");
	});

	it("constructs a service-account client without calling the provider", () => {
		expect(
			createGoogleDriveAssetRepository(
				JSON.stringify({
					type: "service_account",
					client_email: "synthetic@example.test",
					private_key: "synthetic-key",
				}),
				options,
			),
		).toBeInstanceOf(GoogleDriveAssetRepository);
	});

	it.each([
		{ parentFolderId: "", templateFolderId: "templates" },
		{ parentFolderId: "same", templateFolderId: "same" },
	])("validates folder configuration: %j", (invalidOptions) => {
		expect(
			() =>
				new GoogleDriveAssetRepository({} as GoogleDriveClient, invalidOptions),
		).toThrow("Distinct Google Drive");
	});
});
