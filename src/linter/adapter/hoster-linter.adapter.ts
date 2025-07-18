import { inject, injectable, injectFromBase } from "inversify";
import { string } from "zod";
import { AbstractEntityLinkLinterAdapter } from "./abstract-entity-link-linter.adapter";
import { MeetupIssue, MeetupIssueService } from "../../services/meetup-issue.service";
import { LintError } from "../lint.error";
import { InputService, HosterWithUrl } from "../../services/input.service";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class HosterLinterAdapter extends AbstractEntityLinkLinterAdapter<HosterWithUrl> {
  constructor(
    @inject(MeetupIssueService) meetupIssueService: MeetupIssueService,
    @inject(InputService) inputService: InputService
  ) {
    const hosters = inputService.getHosters();
    super(meetupIssueService, hosters);
  }

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const result = await super.lint(meetupIssue, shouldFix);

    const fieldName = this.getFieldName();

    const hosterArray = result.parsedBody[fieldName]!;

    const hosterName = this.extractEntityName(hosterArray[0]);

    if (!this.isValidEntity(hosterName)) {
      throw new LintError([this.getLintErrorMessage(`"${hosterName}" is not an existing hoster`)]);
    }

    const expectedHoster = this.formatEntityWithLink(hosterName);

    // Format hoster with link if shouldFix is true or if it already doesn't have a link
    if (
      shouldFix &&
      (result.parsedBody[fieldName]?.length !== 1 ||
        result.parsedBody[fieldName][0] !== expectedHoster)
    ) {
      result.parsedBody[fieldName] = [expectedHoster];
      this.meetupIssueService.updateMeetupIssueBodyField(meetupIssue, fieldName);
    }

    return result;
  }

  protected updateMeetupIssueIfNeeded(): void {
    // No need to update the meetup issue here, it is done in the lint method
    return;
  }

  protected getValidator() {
    return string()
      .array()
      .min(1, {
        message: "Must not be empty",
      })
      .max(1, {
        message: "Must have exactly one entry",
      });
  }

  protected getFieldName() {
    return "hoster" as const;
  }
}
