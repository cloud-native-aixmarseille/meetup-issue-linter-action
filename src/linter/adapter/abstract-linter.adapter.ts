import { MeetupIssue } from "../../services/meetup-issue.service";
import { LinterAdapter, LinterDependency } from "./linter.adapter";

export abstract class AbstractLinterAdapter implements LinterAdapter {
  getName(): string {
    return this.constructor.name;
  }

  getDependencies(): LinterDependency[] {
    return [];
  }

  abstract lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue>;
}
