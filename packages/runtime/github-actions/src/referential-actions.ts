import * as core from "@actions/core";
import {
	ResultEnvelopeFactory,
	SynchronizeMeetupIssueForm,
	ValidateMeetupReferentials,
} from "@meetup-automation/journey";
import { ActionOutput } from "./action-output.js";
import type { ActionReportData } from "./action-report.js";
import { EventComposition } from "./composition.js";
import { ActionMessages } from "./i18n/action-messages.js";
import { ReferentialActionReport } from "./referential-action-report.js";
import { RuntimeInput } from "./runtime-input.js";

export class ReferentialActions {
	static async runReferentialValidateAction(
		messages = new ActionMessages(),
	): Promise<ActionReportData> {
		const outcome = await EventComposition.createReferentialContainer({
			locale: messages.locale,
		})
			.get(ValidateMeetupReferentials)
			.execute();
		const counts = outcome.isValid
			? {
					hostCount: outcome.catalog.hosts.length,
					speakerCount: outcome.catalog.speakers.length,
				}
			: { hostCount: 0, speakerCount: 0 };
		const report = ReferentialActionReport.validation(
			{ isValid: outcome.isValid, ...counts },
			outcome.diagnostics,
			messages,
		);

		ActionOutput.setJsonOutput(
			"result",
			ResultEnvelopeFactory.resultEnvelope(
				{ isValid: outcome.isValid, ...counts },
				outcome.diagnostics,
			),
		);
		core.setOutput("is-valid", String(outcome.isValid));
		core.setOutput("failure-message", report.failure ?? "");
		core.setOutput("host-count", String(counts.hostCount));
		core.setOutput("speaker-count", String(counts.speakerCount));
		return report;
	}

	static async runReferentialSyncIssueFormAction(
		messages = new ActionMessages(),
	): Promise<ActionReportData> {
		const mode = RuntimeInput.enumInput(
			"mode",
			core.getInput("mode", { required: true }),
			["check", "fix"] as const,
		);
		const outcome = await EventComposition.createReferentialContainer({
			locale: messages.locale,
		})
			.get(SynchronizeMeetupIssueForm)
			.execute({ mode });
		const report = ReferentialActionReport.issueForm(mode, outcome, messages);

		ActionOutput.setJsonOutput(
			"result",
			ResultEnvelopeFactory.resultEnvelope(
				{ changed: outcome.changed, changedFiles: outcome.changedFiles },
				outcome.diagnostics,
			),
		);
		core.setOutput("changed", String(outcome.changed));
		core.setOutput("failure-message", report.failure ?? "");
		ActionOutput.setJsonOutput("changed-files", outcome.changedFiles);
		return report;
	}
}
