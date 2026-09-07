import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	runReferentialSyncIssueFormAction,
	runReferentialValidateAction,
} from "../packages/runtime/github-actions/src/referential-actions.js";

const boundary = vi.hoisted(() => ({
	getInput: vi.fn(),
	setOutput: vi.fn(),
	validate: vi.fn(),
	synchronize: vi.fn(),
	workspaceConfigRepository: vi.fn(() => ({ load: vi.fn() })),
	createReferentialRepository: vi.fn(),
}));

vi.mock("@actions/core", () => ({
	getInput: boundary.getInput,
	setOutput: boundary.setOutput,
}));

vi.mock("../packages/application/journey/src/index.js", () => ({
	AUTOMATION_CONFIG_PATH: ".github/meetup-automation.yml",
	resultEnvelope: (data: unknown, diagnostics: unknown) => ({
		schemaVersion: 1,
		data,
		diagnostics,
	}),
	ValidateMeetupReferentials: class {
		execute = boundary.validate;
	},
	SynchronizeMeetupIssueForm: class {
		execute = boundary.synchronize;
	},
}));

vi.mock("../packages/adapter/yaml-issue-form-projection/src/index.js", () => ({
	YamlIssueFormProjection: class {},
}));

vi.mock("../packages/runtime/github-actions/src/composition.js", () => ({
	workspaceConfigRepository: boundary.workspaceConfigRepository,
	createReferentialRepository: boundary.createReferentialRepository,
}));

describe("referential GitHub Action boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		boundary.getInput.mockImplementation((name: string) =>
			name === "mode" ? "fix" : ".github/meetup-automation.yml",
		);
	});

	it("publishes redacted catalog validation counts", async () => {
		boundary.validate.mockResolvedValue({
			isValid: true,
			catalog: {
				hosts: [{ id: "host-9001" }],
				speakers: [{ id: "speaker-9001" }],
			},
			diagnostics: [],
		});

		await runReferentialValidateAction();

		expect(core.setOutput).toHaveBeenCalledWith("is-valid", "true");
		expect(core.setOutput).toHaveBeenCalledWith("host-count", "1");
		expect(core.setOutput).toHaveBeenCalledWith("speaker-count", "1");
		expect(core.setOutput).toHaveBeenCalledWith("diagnostics", "[]");
		expect(core.setOutput).toHaveBeenCalledWith(
			"result",
			JSON.stringify({
				schemaVersion: 1,
				data: { isValid: true, hostCount: 1, speakerCount: 1 },
				diagnostics: [],
			}),
		);
	});

	it("uses zero public counts for an invalid private catalog", async () => {
		boundary.validate.mockResolvedValue({
			isValid: false,
			diagnostics: [
				{
					code: "referential.invalid",
					severity: "error",
					message: "Invalid row",
				},
			],
		});

		await runReferentialValidateAction();

		expect(core.setOutput).toHaveBeenCalledWith("is-valid", "false");
		expect(core.setOutput).toHaveBeenCalledWith("host-count", "0");
		expect(core.setOutput).toHaveBeenCalledWith("speaker-count", "0");
	});

	it("publishes deterministic issue-form projection outputs", async () => {
		boundary.synchronize.mockResolvedValue({
			changed: true,
			changedFiles: [".github/ISSUE_TEMPLATE/meetup.yml"],
			diagnostics: [],
		});

		await runReferentialSyncIssueFormAction();

		expect(boundary.synchronize).toHaveBeenCalledWith({
			configPath: ".github/meetup-automation.yml",
			mode: "fix",
		});
		expect(core.setOutput).toHaveBeenCalledWith("changed", "true");
		expect(core.setOutput).toHaveBeenCalledWith(
			"changed-files",
			'[".github/ISSUE_TEMPLATE/meetup.yml"]',
		);
		expect(core.setOutput).toHaveBeenCalledWith("diagnostics", "[]");
	});
});
