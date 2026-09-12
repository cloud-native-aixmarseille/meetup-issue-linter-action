import type { ManageMeetupAssets } from "@meetup-automation/journey";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPublicationReconcileAssetsAction } from "./publication-action.js";

const mocks = vi.hoisted(() => ({
	inputs: {} as Record<string, string>,
	outputs: {} as Record<string, string>,
	setSecret: vi.fn(),
	createAssets: vi.fn(),
	execute: vi.fn(),
	dependencies: undefined as
		| ConstructorParameters<typeof ManageMeetupAssets>[0]
		| undefined,
	createEventComposition: vi.fn(),
	createReferentialRepository: vi.fn(),
}));
vi.mock("@actions/core", () => ({
	getInput: (name: string) => mocks.inputs[name] ?? "",
	setOutput: (name: string, value: string) => {
		mocks.outputs[name] = value;
	},
	setSecret: mocks.setSecret,
}));
vi.mock("@actions/github", () => ({
	context: { repo: { owner: "community", repo: "meetups" } },
	getOctokit: vi.fn(),
}));
vi.mock("@meetup-automation/google-drive-asset-repository", () => ({
	createGoogleDriveAssetRepository: mocks.createAssets,
}));
vi.mock("@meetup-automation/journey", async (importOriginal) => ({
	...(await importOriginal<typeof import("@meetup-automation/journey")>()),
	ManageMeetupAssets: class {
		constructor(
			dependencies: ConstructorParameters<typeof ManageMeetupAssets>[0],
		) {
			mocks.dependencies = dependencies;
		}
		execute = mocks.execute;
	},
}));
vi.mock("./composition.js", () => ({
	createEventComposition: mocks.createEventComposition,
	createReferentialRepository: mocks.createReferentialRepository,
	workspaceConfigRepository: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
	mocks.inputs = {
		"issue-number": "42",
		mode: "check",
		"github-token": "github-test-token",
		"managed-comment-author": "test[bot]",
	};
	mocks.outputs = {};
	mocks.execute.mockResolvedValue({
		skipped: false,
		persisted: false,
		assetUrl: "https://drive.google.com/drive/folders/folder",
		files: { "slides-link": "https://docs.google.com/presentation/d/slides" },
		diagnostics: [],
	});
});

describe("publication action boundary", () => {
	it("leaves assets manual when the optional credential is absent", async () => {
		await runPublicationReconcileAssetsAction();
		expect(JSON.parse(mocks.outputs.result)).toMatchObject({
			schemaVersion: 1,
			data: { skipped: true, files: {} },
			diagnostics: [{ code: "publication.assets.unavailable" }],
		});
		expect(mocks.outputs["drive-files"]).toBe("{}");
		expect(mocks.outputs["asset-url"]).toBe("");
		expect(mocks.createAssets).not.toHaveBeenCalled();
	});

	it.each([
		"check",
		"fix",
	])("masks credentials and serializes the %s result", async (mode) => {
		Object.assign(mocks.inputs, {
			mode,
			"google-credentials": "secret-json",
		});
		vi.stubEnv("GOOGLE_DRIVE_MEETUP_FOLDER_ID", "parent");
		vi.stubEnv("GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID", "templates");
		await runPublicationReconcileAssetsAction();
		expect(mocks.setSecret).toHaveBeenCalledWith("secret-json");
		expect(mocks.createAssets).toHaveBeenCalledWith("secret-json", {
			parentFolderId: "parent",
			templateFolderId: "templates",
		});
		expect(mocks.execute).toHaveBeenCalledWith(
			expect.objectContaining({
				identity: { repository: "community/meetups", issueNumber: 42 },
				mode,
			}),
		);
		expect(JSON.parse(mocks.outputs["drive-files"])).toHaveProperty(
			"slides-link",
		);
		expect(mocks.outputs.diagnostics).toBe("[]");
		expect(JSON.stringify(mocks.outputs)).not.toContain("secret-json");
	});

	it("passes missing folder configuration to the validating adapter and handles skipped events", async () => {
		mocks.inputs["google-credentials"] = "secret-json";
		vi.stubEnv("GOOGLE_DRIVE_MEETUP_FOLDER_ID", undefined);
		vi.stubEnv("GOOGLE_DRIVE_MEETUP_TEMPLATE_FOLDER_ID", undefined);
		mocks.execute.mockResolvedValue({
			skipped: true,
			persisted: false,
			files: {},
			diagnostics: [],
		});
		await runPublicationReconcileAssetsAction();
		expect(mocks.createAssets).toHaveBeenCalledWith("secret-json", {
			parentFolderId: "",
			templateFolderId: "",
		});
		expect(mocks.outputs["asset-url"]).toBe("");
	});
});
