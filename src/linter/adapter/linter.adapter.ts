import { MeetupIssue } from "../../services/meetup-issue.service.js";

export const LINTER_ADAPTER_IDENTIFIER = Symbol("LinterAdapter");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LinterDependency = { new (...args: any[]): LinterAdapter };

export interface LinterAdapter {
  getName(): string;

  lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue>;

  getDependencies(): LinterDependency[];
}
