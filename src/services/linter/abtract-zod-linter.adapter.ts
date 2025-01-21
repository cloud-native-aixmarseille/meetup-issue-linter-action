import { ZodType } from "zod";
import { fromError } from "zod-validation-error";
import {
  MEETUP_ISSUE_BODY_FIELD_LABELS,
  MeetupIssue,
  MeetupIssueBody,
  MeetupIssueBodyFields,
} from "../meetup-issue.service";
import { LintError } from "./lint.error";
import { LinterAdapter } from "./linter.adapter";

export abstract class AbstractZodLinterAdapter<
  MeetupIssueBodyField extends MeetupIssueBodyFields = MeetupIssueBodyFields,
> implements LinterAdapter
{
  constructor() {}

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const fieldName = this.getFieldName();
    const validator = this.getValidator();

    const fieldToValidate = meetupIssue.body[fieldName];

    const result = await validator.safeParseAsync(fieldToValidate);
    if (result.success) {
      if (shouldFix) {
        meetupIssue.body[fieldName] = result.data;
      }

      return meetupIssue;
    }

    const validationError = fromError(result.error, {});

    const fieldLabel = MEETUP_ISSUE_BODY_FIELD_LABELS[fieldName];

    const errors = validationError
      .toString()
      .replace(`Validation error: `, `${fieldLabel}: `)
      .split("\n");

    throw new LintError(errors);
  }

  protected abstract getFieldName(): MeetupIssueBodyField;

  protected abstract getValidator(): ZodType<MeetupIssueBody[MeetupIssueBodyField]>;

  abstract getPriority(): number;
}
