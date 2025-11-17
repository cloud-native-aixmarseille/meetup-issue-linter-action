import { MeetupIssue } from "../../services/meetup-issue.service.js";
import { LinterAdapter, LinterDependency } from "./linter.adapter.js";

export abstract class AbstractLinterAdapter implements LinterAdapter {
  getName(): string {
    return this.constructor.name;
  }

  getDependencies(): LinterDependency[] {
    return [];
  }

  abstract lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue>;
}
