import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionRunner } from "./action-runner.js";

vi.mock("@actions/core", () => ({
	getInput: vi.fn().mockReturnValue("en"),
	info: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
	notice: vi.fn(),
	setFailed: vi.fn(),
	setOutput: vi.fn(),
	summary: {
		addHeading: vi.fn().mockReturnThis(),
		addRaw: vi.fn().mockReturnThis(),
		write: vi.fn().mockResolvedValue(undefined),
		clear: vi.fn().mockReturnThis(),
	},
}));

describe("action runner reporting contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(core.getInput).mockReturnValue("en");
	});

	it.each(["Completed.", "Skipped: optional service is unavailable."])(
		"reports a normal outcome: %s",
		async (detail) => {
			// Arrange
			const operation = vi
				.fn()
				.mockResolvedValue({ details: [detail], diagnostics: [] });

			// Act
			await ActionRunner.run("action.event.reconcile", operation);

			// Assert
			expect(operation).toHaveBeenCalledOnce();
			expect(core.info).toHaveBeenCalledWith(detail);
			expect(core.summary.addRaw).toHaveBeenCalledWith(
				expect.stringContaining(detail),
			);
			expect(core.setOutput).toHaveBeenCalledWith("diagnostics", "[]");
			expect(core.setFailed).not.toHaveBeenCalled();
		},
	);

	it("publishes validation errors without changing the caller's failure policy", async () => {
		// Arrange
		const diagnostics = [
			{
				code: "example.invalid",
				severity: "error",
				field: "records[1].id",
				message: "Correct the identifier.",
			},
		];
		const operation = vi
			.fn()
			.mockResolvedValue({ details: ["Invalid catalog."], diagnostics });

		// Act
		await ActionRunner.run("action.event.reconcile", operation);

		// Assert
		expect(core.error).toHaveBeenCalledWith(
			"[example.invalid] (records[1].id): Correct the identifier.",
		);
		expect(core.setOutput).toHaveBeenCalledWith(
			"diagnostics",
			JSON.stringify(diagnostics),
		);
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it("honors explicit failures even if the job summary is unavailable", async () => {
		// Arrange
		const operation = vi.fn().mockResolvedValue({
			details: ["Delivery rejected."],
			diagnostics: [],
			failure: "Reconciliation failed.",
		});
		vi.mocked(core.summary.write).mockRejectedValueOnce(
			new Error("private@example.test"),
		);

		// Act
		await ActionRunner.run("action.event.reconcile", operation);

		// Assert
		expect(core.setFailed).toHaveBeenCalledWith("Reconciliation failed.");
		expect(core.summary.addRaw).toHaveBeenCalledWith(
			expect.stringContaining("Action failed: Reconciliation failed."),
		);
		expect(core.setOutput).toHaveBeenCalledWith("diagnostics", "[]");
	});

	it("reports safe exception messages in annotations, diagnostics output, and the summary", async () => {
		// Arrange
		const error = new Error("The event could not be found.");
		error.name = "EventNotFoundError";
		const operation = vi.fn().mockRejectedValue(error);

		// Act
		await ActionRunner.run("action.event.reconcile", operation);

		// Assert
		expect(core.error).toHaveBeenCalledWith(
			"[action.execution.failed]: EventNotFoundError: The event could not be found.",
		);
		expect(core.summary.addRaw).toHaveBeenCalledWith(
			expect.stringContaining("The event could not be found."),
		);
		expect(core.setFailed).toHaveBeenCalledWith(
			"EventNotFoundError: The event could not be found.",
		);
		expect(core.setOutput).toHaveBeenCalledWith(
			"diagnostics",
			expect.stringContaining("action.execution.failed"),
		);
	});

	it.each([
		new Error("private@example.test"),
		{ response: "private@example.test" },
	])(
		"redacts unknown exception content from every reporting surface",
		async (error) => {
			// Arrange
			const operation = vi.fn().mockRejectedValue(error);

			// Act
			await ActionRunner.run("action.event.reconcile", operation);

			// Assert
			expect(core.setFailed).toHaveBeenCalledOnce();
			expect(core.summary.write).toHaveBeenCalledOnce();
			expect(core.summary.addRaw).toHaveBeenCalledWith(
				expect.stringContaining("Review the action inputs"),
			);
			expect(
				JSON.stringify([
					vi.mocked(core.error).mock.calls,
					vi.mocked(core.info).mock.calls,
					vi.mocked(core.setFailed).mock.calls,
					vi.mocked(core.setOutput).mock.calls,
					vi.mocked(core.summary.addRaw).mock.calls,
				]),
			).not.toContain("private@example.test");
		},
	);
	it("uses one resolved locale throughout the report while preserving diagnostic JSON", async () => {
		// Arrange
		vi.mocked(core.getInput).mockReturnValue("fr-CA");
		const diagnostics = [
			{
				code: "referential.speaker.id.duplicate",
				severity: "error" as const,
				field: "speakers[2].speakerId",
				message: "Speaker stable identifiers must be unique.",
			},
		];
		const operation = vi.fn(
			async (messages: import("./i18n/action-messages.js").ActionMessages) => ({
				details: [messages.t("report.referential.invalid")],
				diagnostics,
			}),
		);
		// Act
		await ActionRunner.run("action.referential.validate", operation);
		// Assert
		expect(core.getInput).toHaveBeenCalledWith("locale");
		expect(core.info).toHaveBeenCalledWith("Référentiels : invalides.");
		expect(core.summary.addHeading).toHaveBeenCalledWith(
			"Valider les référentiels du meetup",
			2,
		);
		expect(core.error).toHaveBeenCalledWith(
			"[referential.speaker.id.duplicate] (speakers[2].speakerId): Les identifiants stables des intervenants doivent être uniques.",
		);
		expect(core.setOutput).toHaveBeenCalledWith(
			"diagnostics",
			JSON.stringify(diagnostics),
		);
		expect(core.setFailed).not.toHaveBeenCalled();
	});
	it("redacts exceptions in French on every reporting surface", async () => {
		// Arrange
		vi.mocked(core.getInput).mockReturnValue("fr");
		const operation = vi
			.fn()
			.mockRejectedValue(new Error("private@example.test"));
		// Act
		await ActionRunner.run("action.event.reconcile", operation);
		// Assert
		expect(core.setFailed).toHaveBeenCalledWith(
			expect.stringContaining("L'automatisation"),
		);
		expect(core.error).toHaveBeenCalledWith(
			expect.stringContaining("L'automatisation"),
		);
		expect(core.summary.addRaw).toHaveBeenCalledWith(
			expect.stringContaining("Vérifiez les paramètres"),
		);
		expect(
			JSON.stringify([
				vi.mocked(core.error).mock.calls,
				vi.mocked(core.setOutput).mock.calls,
				vi.mocked(core.summary.addRaw).mock.calls,
			]),
		).not.toContain("private@example.test");
	});
});
