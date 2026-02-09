import { setFailed } from "@actions/core";
import { InputService } from "./services/input.service.js";
import { LoggerService } from "./services/logger.service.js";
import { container } from "./container.js";
import { LinterService } from "./linter/linter.service.js";
import { MeetupIssueService } from "./services/meetup-issue.service.js";
import { LintError } from "./linter/lint.error.js";
import { CORE_SERVICE_IDENTIFIER, CoreService } from "./services/core.service.js";

/**
 * The run function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const loggerService = container.get(LoggerService);
    const inputService = container.get(InputService);
    const linterService = container.get(LinterService);
    const meetupIssueService = container.get(MeetupIssueService);
    const coreService = container.get<CoreService>(CORE_SERVICE_IDENTIFIER);

    const issueNumber = inputService.getIssueNumber();
    loggerService.debug(`Issue number: ${issueNumber}`);

    const IssueParsedBody = inputService.getIssueParsedBody();
    loggerService.debug(`Parsed issue body: ${JSON.stringify(IssueParsedBody)}`);

    const shouldFix = inputService.getShouldFix();
    loggerService.debug(`Should fix: ${shouldFix}`);

    const failOnError = inputService.getFailOnError();
    loggerService.debug(`Fail on error: ${failOnError}`);

    loggerService.info(`Start linting issue ${issueNumber}...`);

    const meetupIssue = await meetupIssueService.getMeetupIssue(issueNumber, IssueParsedBody);

    try {
      await linterService.lint(meetupIssue, shouldFix);
      loggerService.info("Issue linted successfully.");
    } catch (error) {
      if (!(error instanceof LintError)) {
        throw error;
      }

      coreService.setOutput("lint-issues", error.getMessages().join("\n"));

      if (failOnError) {
        throw error;
      }

      loggerService.info("Issue linted with issues.");
    }
  } catch (error) {
    setFailed(`${error instanceof Error ? error : JSON.stringify(error)}`);
  }
}
