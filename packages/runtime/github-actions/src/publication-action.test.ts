import type { ManageMeetupAssets } from "@meetup-automation/journey";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicationAction } from "./publication-action.js";

const mocks = vi.hoisted(() => ({
	outputs: {} as Record<string, string>,
	setSecret: vi.fn(),
	createAssets: vi.fn(),
	execute: vi.fn(),
	dependencies: undefined as
		| ConstructorParameters<typeof ManageMeetupAssets>[0]
		| undefined,
}));

vi.mock("@actions/core", async (importOriginal) => ({
	...(await importOriginal<typeof import("@actions/core")>()),
	setOutput: (name: string, value: string) => {
		mocks.outputs[name] = value;
	},
	setSecret: mocks.setSecret,
}));

vi.mock("@actions/github", () => ({
	context: { repo: { owner: "community", repo: "meetups" } },
	getOctokit: () => ({}),
}));

vi.mock("@meetup-automation/google-drive-asset-repository", () => ({
	GoogleDriveAssetRepository: {
		createGoogleDriveAssetRepository: mocks.createAssets,
	},
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

beforeEach(() => {
	vi.clearAllMocks();
	for (const [name, value] of Object.entries({
		"issue-number": "42",
		"github-token": "github-test-token",
		"managed-comment-author": "test[bot]",
		"google-credentials": "secret-json",
		"google-drive-meetup-folder-id": "parent",
		"google-drive-meetup-template-folder-id": "templates",
	})) {
		vi.stubEnv(`INPUT_${name.toUpperCase()}`, value);
	}
	mocks.outputs = {};
	mocks.createAssets.mockReturnValue({});
	mocks.execute.mockResolvedValue({
		skipped: false,
		persisted: false,
		assetUrl: "https://drive.google.com/drive/folders/folder",
		files: { "slides-link": "https://docs.google.com/presentation/d/slides" },
		diagnostics: [],
	});
});

afterEach(() => vi.unstubAllEnvs());

describe("publication action boundary", () => {
	it.each([
		"google-credentials",
		"google-drive-meetup-folder-id",
		"google-drive-meetup-template-folder-id",
	])("requires %s before reconciling", async (input) => {
		// Arrange
		vi.stubEnv(`INPUT_${input.toUpperCase()}`, "");

		// Act
		const operation = PublicationAction.runPublicationReconcileAssetsAction();

		// Assert
		await expect(operation).rejects.toThrow(
			`Input required and not supplied: ${input}`,
		);
		expect(mocks.createAssets).not.toHaveBeenCalled();
		expect(mocks.execute).not.toHaveBeenCalled();
		expect(mocks.outputs).toEqual({});
	});

	it("masks credentials and reconciles assets without a mode input", async () => {
		// Arrange
		vi.stubEnv("INPUT_MODE", "");

		// Act
		const report =
			await PublicationAction.runPublicationReconcileAssetsAction();
		const actual = JSON.parse(mocks.outputs["drive-files"]);
		const actual1 = JSON.stringify(mocks.outputs);

		// Assert
		expect(mocks.setSecret).toHaveBeenCalledWith("secret-json");
		expect(mocks.createAssets).toHaveBeenCalledWith("secret-json", {
			parentFolderId: "parent",
			templateFolderId: "templates",
		});
		expect(mocks.execute).toHaveBeenCalledWith(
			expect.objectContaining({
				identity: { repository: "community/meetups", issueNumber: 42 },
			}),
		);
		expect(actual).toHaveProperty("slides-link");
		expect(report.diagnostics).toEqual([]);
		expect(report.details).toContain("Asset reconciliation completed.");
		expect(actual1).not.toContain("secret-json");
	});

	it("reports skipped events with supplied Google Drive configuration", async () => {
		// Arrange
		mocks.execute.mockResolvedValue({
			skipped: true,
			persisted: false,
			files: {},
			diagnostics: [],
		});

		// Act
		const report =
			await PublicationAction.runPublicationReconcileAssetsAction();

		// Assert
		expect(mocks.createAssets).toHaveBeenCalledWith("secret-json", {
			parentFolderId: "parent",
			templateFolderId: "templates",
		});
		expect(mocks.outputs["asset-url"]).toBe("");
		expect(report.details.join("\n")).toContain(
			"Asset reconciliation was skipped",
		);
	});
});
