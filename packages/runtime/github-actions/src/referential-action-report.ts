import type {
	IssueFormProjectionMode,
	PublicDiagnostic,
	SynchronizeMeetupIssueFormResult,
} from "@meetup-automation/journey";
import type { ActionReportData } from "./action-report.js";
import { ActionMessages } from "./i18n/action-messages.js";

export class ReferentialActionReport {
	static validation(
		result: { isValid: boolean; hostCount: number; speakerCount: number },
		diagnostics: readonly PublicDiagnostic[],
		messages = new ActionMessages(),
	): ActionReportData {
		const details = [
			messages.t(
				result.isValid
					? "report.referential.valid"
					: "report.referential.invalid",
			),
			messages.t("report.referential.counts", {
				hosts: result.hostCount,
				speakers: result.speakerCount,
			}),
		];
		if (!result.isValid) {
			details.push(messages.t("report.referential.guidance"));
		}
		return {
			details,
			diagnostics,
			failure: result.isValid
				? undefined
				: messages.t("workflow.referential.failed"),
		};
	}

	static issueForm(
		mode: IssueFormProjectionMode,
		result: SynchronizeMeetupIssueFormResult,
		messages = new ActionMessages(),
	): ActionReportData {
		const details: string[] = [];
		let failure: string | undefined;
		if (result.diagnostics.some((item) => item.severity === "error")) {
			details.push(messages.t("report.issue-form.blocked"));
			failure = messages.t("workflow.referential.failed");
		} else if (result.changed) {
			details.push(
				mode === "check"
					? messages.t("report.issue-form.stale")
					: messages.t("report.issue-form.updated"),
				messages.t("report.issue-form.files", {
					files: result.changedFiles.join(", "),
				}),
			);
			if (mode === "check")
				details.push(messages.t("report.issue-form.drift-allowed"));
		} else {
			details.push(messages.t("report.issue-form.current"));
		}
		return { details, diagnostics: result.diagnostics, failure };
	}
}
