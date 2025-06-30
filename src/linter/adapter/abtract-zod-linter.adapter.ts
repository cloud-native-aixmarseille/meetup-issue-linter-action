import { ZodType } from "zod";
import { fromError } from "zod-validation-error";
import {
  MEETUP_ISSUE_BODY_FIELD_LABELS,
  MeetupIssue,
  MeetupIssueBody,
  MeetupIssueBodyFields,
  MeetupIssueService,
} from "../../services/meetup-issue.service";
import { LintError } from "../lint.error";
import { LinterAdapter } from "./linter.adapter";
import { inject, injectable } from "inversify";

@injectable()
export abstract class AbstractZodLinterAdapter<
  MeetupIssueBodyField extends MeetupIssueBodyFields = MeetupIssueBodyFields,
> implements LinterAdapter
{
  constructor(
    @inject(MeetupIssueService) protected readonly meetupIssueService: MeetupIssueService
  ) {}

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const fieldName = this.getFieldName();
    const validator = this.getValidator();

    const fieldToValidate = meetupIssue.parsedBody[fieldName];

    const result = await validator.safeParseAsync(fieldToValidate);
    if (result.success) {
      if (shouldFix && meetupIssue.parsedBody[fieldName] !== result.data) {
        meetupIssue.parsedBody[fieldName] = result.data;
        this.meetupIssueService.updateMeetupIssueBodyField(meetupIssue, fieldName);
      }

      return meetupIssue;
    }

    const validationError = fromError(result.error, {});

    const errors = validationError
      .toString()
      .replace(`Validation error: `, ``)
      .split("\n")
      .map((error) => this.getLintErrorMessage(error))
      .filter(Boolean);

    throw new LintError(errors);
  }

  protected getLintErrorMessage(message: string): string {
    const fieldName = this.getFieldName();
    const fieldLabel = MEETUP_ISSUE_BODY_FIELD_LABELS[fieldName];

    return `${fieldLabel}: ${message.trim()}`;
  }

  protected abstract getFieldName(): MeetupIssueBodyField;

  protected abstract getValidator(): ZodType<MeetupIssueBody[MeetupIssueBodyField]>;

  getDependencies() {
    return [];
  }
}
