import { inject, injectable, multiInject } from "inversify";
import { LINTER_ADAPTER_IDENTIFIER, LinterAdapter } from "./adapter/linter.adapter.js";
import {
  MeetupIssue,
  MeetupIssueBodyFields,
  MeetupIssueService,
} from "../services/meetup-issue.service.js";
import { LintError } from "./lint.error.js";
import { LinterSortedQueue } from "./linter.sorted-queue.js";
import { LoggerService } from "../services/logger.service.js";

type LintResult = {
  meetupIssue: MeetupIssue;
  lintError?: LintError;
};

@injectable()
export class LinterService {
  constructor(
    @multiInject(LINTER_ADAPTER_IDENTIFIER) private readonly linters: LinterAdapter[],
    @inject(MeetupIssueService) private readonly meetupIssueService: MeetupIssueService,
    @inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    let lintedMeetupIssue = JSON.parse(JSON.stringify(meetupIssue));
    let aggregatedError: LintError | undefined;

    const linterQueue = new LinterSortedQueue(this.linters);

    let linter: LinterAdapter | undefined;
    while ((linter = linterQueue.dequeue())) {
      this.loggerService.debug(`Running linter: ${linter.getName()}`);

      const lintResult = await this.runSingleLinter(linter, lintedMeetupIssue, shouldFix);

      linterQueue.setCompletedLinter(linter, !lintResult.lintError);

      lintedMeetupIssue = lintResult.meetupIssue;
      aggregatedError = this.getAggregatedError(lintResult, aggregatedError);

      this.loggerService.debug(
        `Linter completed: ${linter.getName()}: ${lintResult.lintError ? lintResult.lintError.message : "Success"}`
      );
    }

    // Ensure we have processed all linters
    const completedLinters = linterQueue.getCompletedLinters();
    if (completedLinters.size !== this.linters.length) {
      const nonProcessedLinters = this.linters
        .map((linter) => linter.getName())
        .filter((name) => !completedLinters.has(name));
      throw new Error(`Not all linters were processed: ${nonProcessedLinters.join(", ")}`);
    }

    if (shouldFix) {
      this.loggerService.debug("Updating meetup issue with fixes...");
      await this.updateMeetupIssue(meetupIssue, lintedMeetupIssue);
    }

    if (aggregatedError) {
      throw aggregatedError;
    }

    return lintedMeetupIssue;
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

  private async updateMeetupIssue(
    originalIssue: MeetupIssue,
    lintedMeetupIssue: MeetupIssue
  ): Promise<void> {
    // First, update body sections for any parsed fields that changed
    for (const key of Object.keys(lintedMeetupIssue.parsedBody) as MeetupIssueBodyFields[]) {
      const originalValue = originalIssue.parsedBody[key];
      const updatedValue = lintedMeetupIssue.parsedBody[key];

      if (!this.areValuesEqual(originalValue, updatedValue)) {
        this.loggerService.debug(
          `Updating meetup issue field "${key}": "${originalValue}" => "${updatedValue}"`
        );
        await this.meetupIssueService.updateMeetupIssueBodyField(lintedMeetupIssue, key);
      }
    }

    // Then persist issue-level changes (title/body/labels) if any differ
    await this.meetupIssueService.updateMeetupIssue(originalIssue, lintedMeetupIssue);

    // Update issue title if changed
    if (originalIssue.title !== lintedMeetupIssue.title) {
      this.loggerService.debug(
        `Updating meetup issue title: "${originalIssue.title}" => "${lintedMeetupIssue.title}"`
      );
    }
  }

  private areValuesEqual(valueA: unknown, valueB: unknown): boolean {
    if (Array.isArray(valueA) || Array.isArray(valueB)) {
      return JSON.stringify(valueA) === JSON.stringify(valueB);
    }

    return valueA === valueB;
  }
}
