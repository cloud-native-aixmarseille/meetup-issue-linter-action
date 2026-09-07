import * as core from "@actions/core";
import {
	AUTOMATION_CONFIG_PATH,
	resultEnvelope,
	SynchronizeMeetupIssueForm,
	ValidateMeetupReferentials,
} from "@meetup-automation/journey";
import { YamlIssueFormProjection } from "@meetup-automation/yaml-issue-form-projection";
import { setDiagnosticsOutput, setJsonOutput } from "./action-output.js";
import {
	createReferentialRepository,
	workspaceConfigRepository,
} from "./composition.js";
import { enumInput } from "./runtime-input.js";

export async function runReferentialValidateAction(): Promise<void> {
	const dependencies = {
		configRepository: workspaceConfigRepository(),
		createReferentialRepository: (
			config: Parameters<typeof createReferentialRepository>[0],
		) => createReferentialRepository(config),
	};
	const outcome = await new ValidateMeetupReferentials(dependencies).execute(
		AUTOMATION_CONFIG_PATH,
	);
	const counts = outcome.isValid
		? {
				hostCount: outcome.catalog.hosts.length,
				speakerCount: outcome.catalog.speakers.length,
			}
		: { hostCount: 0, speakerCount: 0 };

	setJsonOutput(
		"result",
		resultEnvelope(
			{ isValid: outcome.isValid, ...counts },
			outcome.diagnostics,
		),
	);
	core.setOutput("is-valid", String(outcome.isValid));
	core.setOutput("host-count", String(counts.hostCount));
	core.setOutput("speaker-count", String(counts.speakerCount));
	setDiagnosticsOutput(outcome.diagnostics);
}

export async function runReferentialSyncIssueFormAction(): Promise<void> {
	const mode = enumInput("mode", core.getInput("mode", { required: true }), [
		"check",
		"fix",
	] as const);
	const outcome = await new SynchronizeMeetupIssueForm({
		configRepository: workspaceConfigRepository(),
		createReferentialRepository: (config) =>
			createReferentialRepository(config),
		issueFormProjection: new YamlIssueFormProjection({
			workspaceRoot: process.cwd(),
		}),
	}).execute({ configPath: AUTOMATION_CONFIG_PATH, mode });

	setJsonOutput(
		"result",
		resultEnvelope(
			{ changed: outcome.changed, changedFiles: outcome.changedFiles },
			outcome.diagnostics,
		),
	);
	core.setOutput("changed", String(outcome.changed));
	setJsonOutput("changed-files", outcome.changedFiles);
	setDiagnosticsOutput(outcome.diagnostics);
}
