import type { MeetupIssue } from "../../services/meetup-issue.service.js";

export const LINTER_ADAPTER_IDENTIFIER = Symbol("LinterAdapter");

export type LinterDependency = { new (...args: never[]): LinterAdapter };

export interface LinterAdapter {
	lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue>;

	getDependencies(): LinterDependency[];
}
