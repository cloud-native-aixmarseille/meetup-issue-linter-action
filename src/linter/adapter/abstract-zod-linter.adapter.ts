import { ZodType } from "zod";
import { fromError } from "zod-validation-error";
import { injectable } from "inversify";

import {
  MEETUP_ISSUE_BODY_FIELD_LABELS,
  MeetupIssue,
  MeetupIssueBody,
  MeetupIssueBodyFields,
} from "../../services/meetup-issue.service.js";
import { LintError } from "../lint.error.js";
import { AbstractLinterAdapter } from "./abstract-linter.adapter.js";

@injectable()
export abstract class AbstractZodLinterAdapter<
  MeetupIssueBodyField extends MeetupIssueBodyFields = MeetupIssueBodyFields,
> extends AbstractLinterAdapter {
  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const fieldName = this.getFieldName();
    const validator = this.getValidator();

    const fieldPath = `parsedBody.${fieldName}` as const;

    const fieldValue = meetupIssue.parsedBody[fieldName];

    const result = await validator.safeParseAsync(fieldValue);
    if (result.success) {
      if (shouldFix) {
        meetupIssue.parsedBody[fieldName] = result.data;
      }

      return meetupIssue;
    }

    const validationError = fromError(result.error, {});

    const errors = validationError
      .toString()
      .replace(`Validation error: `, ``)
      .split("\n")
      .map((error) => ({
        field: fieldPath,
        value: fieldValue,
        message: this.getLintErrorMessage(error),
      }))
      .filter((issue) => Boolean(issue.message));

    throw new LintError(errors);
  }

  protected getLintErrorMessage(message: string): string {
    const fieldName = this.getFieldName();
    const fieldLabel = MEETUP_ISSUE_BODY_FIELD_LABELS[fieldName];

    return `${fieldLabel}: ${message.trim()}`;
  }

  protected abstract getFieldName(): MeetupIssueBodyField;

  protected abstract getValidator(): ZodType<MeetupIssueBody[MeetupIssueBodyField]>;
}
