import type { GithubLedgerCommentClient } from "@meetup-automation/github-delivery-ledger";
import type { ActionReportData } from "./action-report.js";
import { ActionMessages } from "./i18n/action-messages.js";

const MARKER = "<!-- meetup-automation:communication-diagnostics:v1 -->";

/** Persist the public communication report before allowing diagnostic errors. */
export class CommunicationIssueReport {
	constructor(
		private readonly comments: GithubLedgerCommentClient,
		private readonly authorLogin: string,
		private readonly messages = new ActionMessages(),
	) {}

	async reconcile(report: ActionReportData): Promise<ActionReportData> {
		const comments = await this.comments.listComments();
		const existing = comments.find(
			(comment) =>
				comment.body.startsWith(MARKER) &&
				comment.authorLogin?.toLowerCase() === this.authorLogin.toLowerCase(),
		);
		const hasErrors = report.diagnostics.some(
			({ severity }) => severity === "error",
		);
		if (!existing && !hasErrors) return report;

		const body = this.render(report);
		if (!existing) await this.comments.createComment(body);
		else if (existing.body !== body)
			await this.comments.updateComment(existing.id, body);

		return {
			details: [
				...report.details,
				this.messages.t("report.communication.issue-reported"),
			],
			diagnostics: report.diagnostics,
		};
	}

	private render(report: ActionReportData): string {
		const lines = [
			this.messages.t("action.communication.reconcile"),
			...report.details,
			...report.diagnostics.map(
				(item) =>
					`${this.messages.t(`report.severity.${item.severity}`)} [${item.code}]: ${this.messages.diagnostic(item.code, item.message)}`,
			),
		];
		if (report.diagnostics.length === 0)
			lines.push(this.messages.t("report.no-diagnostics"));
		const content = lines
			.join("\n")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;");
		return `${MARKER}\n\n<pre>${content}</pre>`;
	}
}
