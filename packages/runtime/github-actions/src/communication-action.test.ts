import * as core from "@actions/core";
import { ManageMeetupCommunications } from "@meetup-automation/journey";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionRunner } from "./action-runner.js";
import { CommunicationAction } from "./communication-action.js";

const boundary = vi.hoisted(() => ({
	execute: vi.fn(),
	listComments: vi.fn(),
	createComment: vi.fn(),
	updateComment: vi.fn(),
}));
vi.mock("@actions/core", async (importOriginal) => ({
	...(await importOriginal<typeof core>()),
	setOutput: vi.fn(),
	setFailed: vi.fn(),
	info: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
	notice: vi.fn(),
	summary: {
		addHeading: vi.fn().mockReturnThis(),
		addRaw: vi.fn().mockReturnThis(),
		write: vi.fn().mockResolvedValue(undefined),
		clear: vi.fn(),
	},
}));
vi.mock("@actions/github", () => ({
	getOctokit: vi.fn(() => ({ rest: { issues: boundary } })),
	context: {
		repo: { owner: "community", repo: "meetups" },
		payload: {},
		actor: "maintainer",
	},
}));
vi.mock("./communication.js", () => ({
	CommunicationRuntime: { runCommunicationReconcile: boundary.execute },
}));

describe("communication action report facts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		boundary.listComments.mockResolvedValue({ data: [], headers: {} });
		for (const [name, value] of Object.entries({
			"report-errors-to-issue": "false",
			"issue-number": "42",
			"github-token": "private-token",
			"mailings-token": "private-mailings-token",
			"slack-token": "private-slack-token",
			"slack-channel-id": "channel-safe-id",
			"managed-comment-author": "automation[bot]",
		})) {
			vi.stubEnv(`INPUT_${name.toUpperCase()}`, value);
		}
	});

	afterEach(() => vi.unstubAllEnvs());

	it.each([
		"report-errors-to-issue",
		"mailings-token",
		"slack-token",
		"slack-channel-id",
	])("requires %s before reconciling communications", async (input) => {
		// Arrange
		vi.stubEnv(`INPUT_${input.toUpperCase()}`, "");

		// Act
		const operation = CommunicationAction.runCommunicationReconcileAction();

		// Assert
		await expect(operation).rejects.toThrow(
			`Input required and not supplied: ${input}`,
		);
		expect(boundary.execute).not.toHaveBeenCalled();
		expect(core.setOutput).not.toHaveBeenCalled();
	});

	it.each([
		["warning", false],
		["error", false],
		["warning", true],
		["error", true],
	] as const)(
		"redacts %s diagnostics with issue reporting %s",
		async (severity, issueReporting) => {
			// Arrange
			vi.stubEnv("INPUT_REPORT-ERRORS-TO-ISSUE", String(issueReporting));
			boundary.execute.mockResolvedValue({
				mode: "check",
				counts: {
					planned: 2,
					due: 1,
					dispatched: 0,
					reserved: 0,
					accepted: 0,
					alreadyRecorded: 1,
					deferred: 0,
					uncertain: 1,
					rejected: 0,
				},
				intentIds: ["private@example.test"],
				diagnostics: [
					{
						code: "gateway-delivery-uncertain",
						severity,
						intentId: "private@example.test",
						message: "private provider response",
					},
				],
				runtimeDiagnostics: [
					{
						code: "communication.approval-missing",
						severity: "warning",
						message: "private approval data",
					},
				],
			});

			// Act
			const report =
				await CommunicationAction.runCommunicationReconcileAction();

			// Assert
			expect(report.details).toContain("Communication mode: check.");
			expect(report.details.join("\n")).toContain(
				"Planned: 2; due: 1; dispatched: 0.",
			);
			expect(report.details.join("\n")).toContain(
				"Reconcile uncertain deliveries",
			);
			expect(report.diagnostics).toContainEqual({
				code: "communication.gateway-delivery-uncertain",
				severity,
				message: "A gateway could not confirm delivery.",
			});
			expect(report.diagnostics).toContainEqual({
				code: "communication.approval-missing",
				severity: "warning",
				message: "Communications require a maintainer-owned approval snapshot.",
			});
			expect(Boolean(report.failure)).toBe(
				severity === "error" && !issueReporting,
			);
			expect(boundary.createComment).toHaveBeenCalledTimes(
				severity === "error" && issueReporting ? 1 : 0,
			);
			expect(boundary.listComments).toHaveBeenCalledTimes(
				issueReporting ? 1 : 0,
			);
			expect(JSON.stringify(boundary.createComment.mock.calls)).not.toContain(
				"private",
			);
			expect(core.setOutput).toHaveBeenCalledWith("planned-count", "2");
			expect(core.setOutput).toHaveBeenCalledWith(
				"result",
				expect.stringContaining("sha256:"),
			);
			expect(
				JSON.stringify([report, vi.mocked(core.setOutput).mock.calls]),
			).not.toContain("private");
		},
	);

	it("reports successful reconciliation without a failure", async () => {
		// Arrange
		boundary.execute.mockResolvedValue({
			mode: "dispatch",
			counts: {
				planned: 1,
				due: 1,
				dispatched: 1,
				reserved: 1,
				accepted: 1,
				alreadyRecorded: 0,
				deferred: 0,
				uncertain: 0,
				rejected: 0,
			},
			intentIds: ["synthetic-intent"],
			diagnostics: [],
			runtimeDiagnostics: [],
		});

		// Act
		const report = await CommunicationAction.runCommunicationReconcileAction();

		// Assert
		expect(boundary.execute).toHaveBeenCalledWith(
			expect.objectContaining({
				mailingsToken: "private-mailings-token",
				slackToken: "private-slack-token",
				slackChannelId: "channel-safe-id",
			}),
		);
		expect(report.details).toContain("Communication mode: dispatch.");
		expect(report.details.join("\n")).toContain("Accepted: 1;");
		expect(report.details.join("\n")).not.toContain("before retrying");
		expect(report.details.join("\n")).not.toContain("before any resend");
		expect(report.diagnostics).toEqual([]);
		expect(report.failure).toBeUndefined();
	});

	it("keeps the job successful after publishing error diagnostics to the issue", async () => {
		// Arrange
		vi.stubEnv("INPUT_REPORT-ERRORS-TO-ISSUE", "true");
		boundary.execute.mockResolvedValue(
			ManageMeetupCommunications.emptyCommunicationResult("check", [
				{
					code: "communication.event-references-unresolved",
					severity: "error",
				},
			]),
		);

		// Act
		await ActionRunner.run(
			"action.communication.reconcile",
			CommunicationAction.runCommunicationReconcileAction,
		);

		// Assert
		expect(boundary.createComment).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: "community",
				repo: "meetups",
				issue_number: 42,
				body: expect.stringContaining(
					"communication.event-references-unresolved",
				),
			}),
		);
		expect(core.error).toHaveBeenCalled();
		expect(core.setOutput).toHaveBeenCalledWith(
			"diagnostics",
			expect.stringContaining('"severity":"error"'),
		);
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it.each([
		"execute",
		"listComments",
		"createComment",
		"updateComment",
	] as const)(
		"fails safely when %s fails with issue reporting enabled",
		async (operation) => {
			// Arrange
			vi.stubEnv("INPUT_REPORT-ERRORS-TO-ISSUE", "true");
			boundary.execute.mockResolvedValue(
				ManageMeetupCommunications.emptyCommunicationResult("check", [
					{
						code: "communication.event-references-unresolved",
						severity: "error",
					},
				]),
			);
			if (operation === "updateComment")
				boundary.listComments.mockResolvedValue({
					data: [
						{
							id: 17,
							body: "<!-- meetup-automation:communication-diagnostics:v1 -->\nOld report",
							user: { login: "automation[bot]" },
						},
					],
					headers: {},
				});
			boundary[operation].mockRejectedValueOnce(
				new Error("private provider response"),
			);

			// Act
			await ActionRunner.run(
				"action.communication.reconcile",
				CommunicationAction.runCommunicationReconcileAction,
			);

			// Assert
			expect(core.setFailed).toHaveBeenCalledOnce();
			expect(core.setOutput).toHaveBeenCalledWith(
				"diagnostics",
				expect.stringContaining("action.execution.failed"),
			);
			expect(
				JSON.stringify([
					vi.mocked(core.setFailed).mock.calls,
					vi.mocked(core.summary.addRaw).mock.calls,
				]),
			).not.toContain("private provider response");
		},
	);

	it("rejects an invalid issue reporting option before executing communications", async () => {
		// Arrange
		vi.stubEnv("INPUT_REPORT-ERRORS-TO-ISSUE", "invalid");

		// Act
		const result = CommunicationAction.runCommunicationReconcileAction();

		// Assert
		await expect(result).rejects.toThrow(
			"report-errors-to-issue must be true or false",
		);
		expect(boundary.execute).not.toHaveBeenCalled();
	});
});
