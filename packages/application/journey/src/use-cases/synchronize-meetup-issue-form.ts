import type {
	IssueFormProjection,
	IssueFormProjectionMode,
} from "../ports/issue-form-projection.js";
import type { PublicDiagnostic } from "../result/result-envelope.js";
import {
	ValidateMeetupReferentials,
	type ValidateMeetupReferentialsDependencies,
} from "./validate-meetup-referentials.js";

export interface SynchronizeMeetupIssueFormDependencies
	extends ValidateMeetupReferentialsDependencies {
	issueFormProjection: IssueFormProjection;
}

export interface SynchronizeMeetupIssueFormResult {
	changed: boolean;
	changedFiles: readonly string[];
	diagnostics: readonly PublicDiagnostic[];
}

export class SynchronizeMeetupIssueForm {
	constructor(
		private readonly dependencies: SynchronizeMeetupIssueFormDependencies,
	) {}

	async execute(input: {
		configPath: string;
		mode: IssueFormProjectionMode;
	}): Promise<SynchronizeMeetupIssueFormResult> {
		const validation = await new ValidateMeetupReferentials(
			this.dependencies,
		).execute(input.configPath);
		if (!validation.isValid) {
			return {
				changed: false,
				changedFiles: [],
				diagnostics: validation.diagnostics,
			};
		}

		const projection = await this.dependencies.issueFormProjection.synchronize({
			issueFormPath: validation.config.event["issue-form"],
			occurrenceStatusFieldId:
				validation.config.event["occurrence-status-field"],
			catalog: validation.catalog,
			mode: input.mode,
		});
		return {
			changed: projection.changed,
			changedFiles: projection.changedFiles,
			diagnostics: [
				...validation.diagnostics,
				...projection.diagnostics.map((item) => ({ ...item })),
			],
		};
	}
}
