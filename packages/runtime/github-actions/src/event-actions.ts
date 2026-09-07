import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
	type EventDiagnostic,
	ListActiveEvents,
} from "@meetup-automation/event";
import {
	AUTOMATION_CONFIG_PATH,
	ManageMeetupEvent,
	type PublicDiagnostic,
	resultEnvelope,
} from "@meetup-automation/journey";
import { setDiagnosticsOutput, setJsonOutput } from "./action-output.js";
import {
	createEventComposition,
	createReferentialRepository,
	workspaceConfigRepository,
} from "./composition.js";
import { enumInput, positiveIntegerInput } from "./runtime-input.js";

export async function runEventReconcileAction(): Promise<void> {
	const issueNumber = positiveIntegerInput(
		"issue-number",
		core.getInput("issue-number", { required: true }),
	);
	const mode = enumInput("mode", core.getInput("mode", { required: true }), [
		"check",
		"fix",
	] as const);
	const token = core.getInput("github-token", { required: true });
	const commentAuthorLogin = core.getInput("managed-comment-author", {
		required: true,
	});
	const { owner, repo } = context.repo;
	const repository = `${owner}/${repo}`;
	const configRepository = workspaceConfigRepository();
	const client = getOctokit(token);

	const useCase = new ManageMeetupEvent({
		configRepository,
		createReferentialRepository: (config) =>
			createReferentialRepository(config),
		createEventDependencies: (config) =>
			createEventComposition({
				client,
				owner,
				repo,
				config,
				commentAuthorLogin,
			}),
	});
	const outcome = await useCase.execute({
		configPath: AUTOMATION_CONFIG_PATH,
		identity: { repository, issueNumber },
		mode,
	});
	const data = outcome.skipped
		? { skipped: true }
		: {
				skipped: false,
				state: outcome.state,
				isReady: outcome.isReady,
				persisted: outcome.persisted,
				commentUpdated: outcome.commentUpdated,
			};

	setJsonOutput("result", resultEnvelope(data, outcome.diagnostics));
	core.setOutput("state", outcome.skipped ? "skipped" : outcome.state);
	core.setOutput(
		"is-ready",
		outcome.skipped ? "false" : String(outcome.isReady),
	);
	setDiagnosticsOutput(outcome.diagnostics);
}

export async function runEventListActiveAction(): Promise<void> {
	const token = core.getInput("github-token", { required: true });
	const { owner, repo } = context.repo;
	const repository = `${owner}/${repo}`;
	const config = await workspaceConfigRepository().load();
	const composition = createEventComposition({
		client: getOctokit(token),
		owner,
		repo,
		config,
		commentAuthorLogin: "github-actions[bot]",
	});
	const outcome = await new ListActiveEvents(composition).execute({
		repository,
		label: config.event["issue-label"],
		includeClosed: true,
		pageSize: 100,
	});
	const issueNumbers = outcome.events.map(
		(event) => event.identity.issueNumber,
	);
	const diagnostics = outcome.diagnostics.map(toPublicDiagnostic);

	setJsonOutput(
		"result",
		resultEnvelope({ issueNumbers, count: issueNumbers.length }, diagnostics),
	);
	setJsonOutput("issue-numbers", issueNumbers);
	setDiagnosticsOutput(diagnostics);
}

function toPublicDiagnostic(diagnostic: EventDiagnostic): PublicDiagnostic {
	return {
		code: diagnostic.code,
		severity: diagnostic.severity,
		message: diagnostic.message,
		...(diagnostic.field ? { field: diagnostic.field } : {}),
	};
}
