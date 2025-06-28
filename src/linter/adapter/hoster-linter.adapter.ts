import { injectable } from "inversify";
import { string } from "zod";
import { AbstractEntityLinkLinterAdapter } from "./abstract-entity-link-linter.adapter";
import { MeetupIssue } from "../../services/meetup-issue.service";
import { LintError } from "../lint.error";
import { InputService, HosterWithUrl } from "../../services/input.service";

@injectable()
export class HosterLinterAdapter extends AbstractEntityLinkLinterAdapter {
  private readonly hosters: [HosterWithUrl, ...HosterWithUrl[]];

  constructor(private readonly inputService: InputService) {
    const hosters = inputService.getHosters();
    super(hosters);

    this.hosters = hosters;
  }

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const result = await super.lint(meetupIssue, shouldFix);

    const hosterArray = result.body[this.getFieldName()]!;

    if (!Array.isArray(hosterArray)) {
      throw new LintError([this.getLintErrorMessage("Must be an array")]);
    }

    if (hosterArray.length === 0) {
      throw new LintError([this.getLintErrorMessage("Must not be empty")]);
    }

    if (hosterArray.length > 1) {
      throw new LintError([this.getLintErrorMessage("Must have exactly one entry")]);
    }

    const hosterName = this.extractEntityName(hosterArray[0]);

    if (!this.isValidEntity(hosterName)) {
      throw new LintError([this.getLintErrorMessage(`"${hosterName}" is not an existing hoster`)]);
    }

    // Format hoster with link if shouldFix is true or if it already doesn't have a link
    if (shouldFix || !this.hasLink(hosterArray[0])) {
      result.body[this.getFieldName()] = [this.formatEntityWithLink(hosterName)];
    }

    return result;
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
