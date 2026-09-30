import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionReportData } from "./action-report.js";
import { CommunicationIssueReport } from "./communication-issue-report.js";
import { ActionMessages } from "./i18n/action-messages.js";

const marker = "<!-- meetup-automation:communication-diagnostics:v1 -->";
const comments = {
	listComments: vi.fn(),
	createComment: vi.fn(),
	updateComment: vi.fn(),
};
const report: ActionReportData = {
	details: ["Review approval and delivery diagnostics before retrying."],
	diagnostics: [
		{
			code: "communication.invalid-event-date",
			severity: "error",
			message: "The event date is invalid.",
		},
	],
	failure: "Communication reconciliation failed.",
};

describe("communication issue reporting", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		comments.listComments.mockResolvedValue([]);
	});

	it("waits for the issue comment before allowing errors", async () => {
		// Arrange
		let finishWrite!: () => void;
		let startWrite!: () => void;
		const writeStarted = new Promise<void>((resolve) => {
			startWrite = resolve;
		});
		comments.createComment.mockImplementation(() => {
			startWrite();
			return new Promise<void>((resolve) => {
				finishWrite = resolve;
			});
		});
		const reporter = new CommunicationIssueReport(comments, "automation[bot]");
		let completed = false;

		// Act
		const pending = reporter.reconcile(report).then((result) => {
			completed = true;
			return result;
		});
		await writeStarted;
		const completedBeforeWrite = completed;
		finishWrite();
		const result = await pending;

		// Assert
		expect(completedBeforeWrite).toBe(false);
		expect(result.failure).toBeUndefined();
		expect(result.diagnostics).toEqual(report.diagnostics);
		expect(comments.createComment).toHaveBeenCalledWith(
			expect.stringContaining("The event date is invalid."),
		);
	});

	it("reuses an unchanged trusted comment without another write", async () => {
		// Arrange
		const reporter = new CommunicationIssueReport(comments, "automation[bot]");

		// Act
		await reporter.reconcile(report);
		const body = comments.createComment.mock.calls[0][0];
		comments.listComments.mockResolvedValue([
			{ id: 23, body, authorLogin: "Automation[bot]" },
		]);
		const result = await reporter.reconcile(report);

		// Assert
		expect(result.failure).toBeUndefined();
		expect(comments.createComment).toHaveBeenCalledOnce();
		expect(comments.updateComment).not.toHaveBeenCalled();
	});

	it("ignores matching comments from an untrusted author", async () => {
		// Arrange
		comments.listComments.mockResolvedValue([
			{ id: 23, body: marker, authorLogin: "visitor" },
		]);
		const reporter = new CommunicationIssueReport(comments, "automation[bot]");

		// Act
		await reporter.reconcile(report);

		// Assert
		expect(comments.createComment).toHaveBeenCalledOnce();
		expect(comments.updateComment).not.toHaveBeenCalled();
	});

	it("replaces stale errors when a later run has no diagnostics", async () => {
		// Arrange
		comments.listComments.mockResolvedValue([
			{ id: 23, body: marker, authorLogin: "automation[bot]" },
		]);
		const reporter = new CommunicationIssueReport(comments, "automation[bot]");

		// Act
		await reporter.reconcile({ details: [], diagnostics: [] });

		// Assert
		expect(comments.updateComment).toHaveBeenCalledWith(
			23,
			expect.stringContaining("No diagnostics."),
		);
		expect(comments.createComment).not.toHaveBeenCalled();
	});

	it("does not create comments for successful runs", async () => {
		// Arrange
		const reporter = new CommunicationIssueReport(comments, "automation[bot]");
		const success = { details: [], diagnostics: [] };

		// Act
		const result = await reporter.reconcile(success);

		// Assert
		expect(result).toEqual(success);
		expect(comments.createComment).not.toHaveBeenCalled();
	});

	it("localizes diagnostics and escapes report text in the issue", async () => {
		// Arrange
		const reporter = new CommunicationIssueReport(
			comments,
			"automation[bot]",
			new ActionMessages("fr"),
		);

		// Act
		await reporter.reconcile({ ...report, details: ["<script> & text"] });

		// Assert
		expect(comments.createComment).toHaveBeenCalledWith(
			expect.stringContaining("La date de l'événement est invalide."), // codespell:ignore invalide
		);
		expect(comments.createComment).toHaveBeenCalledWith(
			expect.stringContaining("&lt;script&gt; &amp; text"),
		);
	});
});
