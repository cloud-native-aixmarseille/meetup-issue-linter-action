import { inject, injectable, multiInject } from "inversify";
import { LINTER_ADAPTER_IDENTIFIER, LinterAdapter } from "./adapter/linter.adapter";
import { MeetupIssue, MeetupIssueService } from "../services/meetup-issue.service";
import { LintError } from "./lint.error";
import { LinterSortedQueue } from "./linter.sorted-queue";

type LintResult = {
  meetupIssue: MeetupIssue;
  lintError?: LintError;
};

@injectable()
export class LinterService {
  constructor(
    @multiInject(LINTER_ADAPTER_IDENTIFIER) private readonly linters: LinterAdapter[],
    @inject(MeetupIssueService) private readonly meetupIssueService: MeetupIssueService
  ) {}

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<void> {
    let lintedMeetupIssue = { ...meetupIssue };
    let aggregatedError: LintError | undefined;

    const linterQueue = new LinterSortedQueue(this.linters);

    let linter: LinterAdapter | undefined;
    while ((linter = linterQueue.dequeue())) {
      const lintResult = await this.runSingleLinter(linter, lintedMeetupIssue, shouldFix);

      linterQueue.setCompletedLinter(linter, !lintResult.lintError);

      lintedMeetupIssue = lintResult.meetupIssue;
      aggregatedError = this.getAggregatedError(lintResult, aggregatedError);
    }

    if (shouldFix) {
      await this.meetupIssueService.updateMeetupIssue(meetupIssue, lintedMeetupIssue);
    }

    if (aggregatedError) {
      throw aggregatedError;
    }
  }

  private async runSingleLinter(
    linter: LinterAdapter,
    meetupIssue: MeetupIssue,
    shouldFix: boolean
  ): Promise<LintResult> {
    try {
      return {
        meetupIssue: await linter.lint(meetupIssue, shouldFix),
      };
    } catch (error) {
      if (error instanceof LintError) {
        return {
          meetupIssue,
          lintError: error,
        };
      }
      throw error;
    }
  }

  private getAggregatedError(
    lintResult: LintResult,
    aggregatedError: LintError | undefined
  ): LintError | undefined {
    if (!lintResult.lintError) {
      return aggregatedError;
    }

    if (aggregatedError) {
      return aggregatedError.merge(lintResult.lintError);
    }

    return lintResult.lintError;
  }
}
