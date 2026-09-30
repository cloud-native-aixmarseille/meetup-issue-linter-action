import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackAction } from "./feedback-action.js";
import { ActionMessages } from "./i18n/action-messages.js";

const mocks = vi.hoisted(() => ({
	inputs: {} as Record<string, string>,
	outputs: {} as Record<string, string>,
	setSecret: vi.fn(),
	getOctokit: vi.fn(),
	compose: vi.fn(),
	execute: vi.fn(),
}));
vi.mock("@actions/core", () => ({
	getInput: (name: string, options?: { required?: boolean }) => {
		const value = mocks.inputs[name] ?? "";
		if (options?.required && !value)
			throw new Error(`Input required and not supplied: ${name}`);
		return value.trim();
	},
	setOutput: (name: string, value: string) => {
		mocks.outputs[name] = value;
	},
	setSecret: mocks.setSecret,
}));
vi.mock("@actions/github", () => ({
	context: { repo: { owner: "example", repo: "meetups" } },
	getOctokit: mocks.getOctokit,
}));
vi.mock("./feedback-composition.js", () => ({
	FeedbackComposition: { createFeedbackContainer: mocks.compose },
}));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.inputs = {
		"issue-number": "12",
		"github-token": "synthetic-token",
		"managed-comment-author": "example[bot]",
		"kutt-api-key": "synthetic-key",
		"kutt-link-id": "link-1",
		"openfeedback-api-key": "oforg_synthetic-secret",
	};
	mocks.outputs = {};
	mocks.compose.mockReturnValue({ get: () => ({ execute: mocks.execute }) });
	mocks.execute.mockResolvedValue({
		skipped: false,
		persisted: true,
		feedbackUrl: "https://openfeedback.io/poll",
		linkUpdated: true,
		diagnostics: [],
	});
});

describe("feedback action boundary", () => {
	it.each([
		["kutt-api-key", ""],
		["kutt-api-key", "   "],
		["kutt-link-id", ""],
		["kutt-link-id", "   "],
	])(
		"rejects missing or blank %s (%j) before requests",
		async (name, value) => {
			// Arrange
			mocks.inputs[name] = value;

			// Act
			const operation = FeedbackAction.run();

			// Assert
			await expect(operation).rejects.toThrow(
				`Input required and not supplied: ${name}`,
			);
			expect(mocks.getOctokit).not.toHaveBeenCalled();
			expect(mocks.compose).not.toHaveBeenCalled();
			expect(mocks.outputs).toEqual({});
		},
	);

	it("masks credentials and reconciles feedback without a mode input", async () => {
		// Arrange
		Object.assign(mocks.inputs, {
			"kutt-api-key": "synthetic-key",
			"kutt-link-id": "link-1",
		});

		// Act
		const report = await FeedbackAction.run();

		// Assert
		expect(report.details).toContain("Feedback reconciliation completed.");
		expect(report.details).toContain(
			"Issue changes persisted: true; shared feedback link updated: true.",
		);
		expect(report.diagnostics).toEqual([]);
		expect(mocks.outputs.diagnostics).toBeUndefined();
		expect(mocks.setSecret).toHaveBeenCalledWith("synthetic-key");
		expect(mocks.execute).toHaveBeenCalledWith({
			identity: { repository: "example/meetups", issueNumber: 12 },
		});
		expect(mocks.outputs["feedback-url"]).toBe("https://openfeedback.io/poll");
		expect(mocks.outputs["link-updated"]).toBe("true");
		expect(JSON.stringify(mocks.outputs)).not.toContain("synthetic-");
	});

	it("forwards both required Kutt settings", async () => {
		// Arrange
		// Default inputs provide both required Kutt settings.

		// Act
		await FeedbackAction.run();

		// Assert
		expect(mocks.compose).toHaveBeenCalledWith(
			expect.objectContaining({
				kuttApiKey: "synthetic-key",
				kuttLinkId: "link-1",
			}),
		);
	});
	it("reports skipped reconciliation without changing its success policy", async () => {
		// Arrange
		const diagnostics = [
			{
				code: "publication.feedback.inactive",
				severity: "info",
				message: "Feedback automation is inactive for this event",
			},
		];
		mocks.execute.mockResolvedValue({
			skipped: true,
			persisted: false,
			linkUpdated: false,
			diagnostics,
		});

		// Act
		const report = await FeedbackAction.run();

		// Assert
		expect(report.details).toContain(
			"Feedback reconciliation was skipped; review the diagnostics for the reason.",
		);
		expect(report.diagnostics).toEqual(diagnostics);
		expect(report.failure).toBeUndefined();
		expect(mocks.outputs["feedback-url"]).toBe("");
		expect(mocks.outputs["link-updated"]).toBe("false");
		expect(mocks.outputs.diagnostics).toBeUndefined();
	});

	it("localizes reports and passes the resolved locale to composition", async () => {
		// Arrange
		const messages = new ActionMessages("fr-CA");

		// Act
		const report = await FeedbackAction.run(messages);

		// Assert
		expect(mocks.compose).toHaveBeenCalledWith(
			expect.objectContaining({ locale: "fr" }),
		);
		expect(report.details).toContain("Ticket : #12 ; mode : fix.");
		expect(report.details).toContain(
			"Modifications du ticket enregistrées : oui ; lien partagé des retours mis à jour : oui.", // codespell:ignore mis
		);
		expect(report.details).toContain(
			"Consultez les diagnostics des retours et configurez les présentations et les intervenants dans OpenFeedback.",
		);
		expect(report.diagnostics).toEqual([]);
	});

	it("masks and forwards the required OpenFeedback organization key", async () => {
		// Arrange
		mocks.inputs["openfeedback-api-key"] = "oforg_synthetic-secret";

		// Act
		await FeedbackAction.run();

		// Assert
		expect(mocks.setSecret).toHaveBeenCalledWith("oforg_synthetic-secret");
		expect(mocks.compose).toHaveBeenCalledWith(
			expect.objectContaining({ openFeedbackApiKey: "oforg_synthetic-secret" }),
		);
		expect(JSON.stringify(mocks.outputs)).not.toContain(
			"oforg_synthetic-secret",
		);
	});

	it.each([undefined, "", "   "])(
		"rejects an absent or blank OpenFeedback key (%j) before requests",
		async (value) => {
			// Arrange
			if (value === undefined) delete mocks.inputs["openfeedback-api-key"];
			else mocks.inputs["openfeedback-api-key"] = value;

			// Act
			const operation = FeedbackAction.run();

			// Assert
			await expect(operation).rejects.toThrow(
				"Input required and not supplied: openfeedback-api-key",
			);
			expect(mocks.getOctokit).not.toHaveBeenCalled();
			expect(mocks.compose).not.toHaveBeenCalled();
			expect(mocks.execute).not.toHaveBeenCalled();
			expect(mocks.outputs).toEqual({});
		},
	);
});
