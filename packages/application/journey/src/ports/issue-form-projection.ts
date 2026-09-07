import type { ReferentialCatalog } from "@meetup-automation/referential";

export type IssueFormProjectionMode = "check" | "fix";

export interface IssueFormProjectionResult {
	readonly changed: boolean;
	readonly changedFiles: readonly string[];
	readonly diagnostics: readonly {
		code: string;
		severity: "error" | "warning" | "info";
		message: string;
	}[];
}

export interface IssueFormProjection {
	synchronize(input: {
		issueFormPath: string;
		occurrenceStatusFieldId: string;
		catalog: ReferentialCatalog;
		mode: IssueFormProjectionMode;
	}): Promise<IssueFormProjectionResult>;
}
