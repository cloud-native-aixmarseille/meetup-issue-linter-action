import { injectable } from "inversify";
import { AbstractLinterAdapter } from "./abstract-linter.adapter.js";
import { MeetupIssue } from "../../services/meetup-issue.service.js";
import { LintError } from "../lint.error.js";
import { EventTitleLinterAdapter } from "./event-title-linter.adapter.js";
import { EventDateLinterAdapter } from "./event-date-linter.adapter.js";

@injectable()
export class TitleLinterAdapter extends AbstractLinterAdapter {
  private static TITLE_PATTERN = "[Meetup] - <date> - <title>";

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const expectedTitle = this.getExpectedTitle(meetupIssue);

    if (meetupIssue.title === expectedTitle) {
      return meetupIssue;
    }

    if (shouldFix) {
      meetupIssue.title = expectedTitle;
      return meetupIssue;
    }

    throw new LintError([
      {
        field: "title",
        value: meetupIssue.title,
        message: `Title: Invalid, expected "${expectedTitle}"`,
      },
    ]);
  }

  getDependencies() {
    return [EventTitleLinterAdapter, EventDateLinterAdapter];
  }

  private getExpectedTitle(meetupIssue: MeetupIssue) {
    const date = meetupIssue.parsedBody.event_date;
    if (!date) {
      throw new Error("Event Date is required to lint the title");
    }
    const title = meetupIssue.parsedBody.event_title;
    if (!title) {
      throw new Error("Event Title is required to lint the title");
    }

    return TitleLinterAdapter.TITLE_PATTERN.replace("<date>", date).replace("<title>", title);
  }
}
