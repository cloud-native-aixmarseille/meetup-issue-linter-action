import { injectable, injectFromBase, inject } from "inversify";
import { AbstractLinkLinterAdapter } from "./abstract-link-linter.adapter";
import { GoogleDriveService } from "../../services/google-drive/google-drive.service";
import { MeetupIssue, MeetupIssueService } from "../../services/meetup-issue.service";
import { LintError } from "../lint.error";
import { EventDateLinterAdapter } from "./event-date-linter.adapter";
import { HosterLinterAdapter } from "./hoster-linter.adapter";
import { LinterDependency } from "./linter.adapter";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class DriveLinkLinterAdapter extends AbstractLinkLinterAdapter {
  private static readonly DRIVE_LINK_REGEX =
    /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9-_]+\/?$/;

  constructor(
    @inject(MeetupIssueService) meetupIssueService: MeetupIssueService,
    @inject(GoogleDriveService) private readonly googleDriveService: GoogleDriveService
  ) {
    super(meetupIssueService);
  }

  getDependencies(): LinterDependency[] {
    return [EventDateLinterAdapter, HosterLinterAdapter];
  }

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    try {
      const result = await super.lint(meetupIssue, shouldFix);
      return result;
    } catch (error) {
      if (!shouldFix) {
        throw error;
      }

      const driveLink = meetupIssue.parsedBody.drive_link;
      const needsAutoFix = !driveLink || !DriveLinkLinterAdapter.DRIVE_LINK_REGEX.test(driveLink);

      if (!needsAutoFix) {
        throw error;
      }

      const eventDate = meetupIssue.parsedBody.event_date;
      const hoster = meetupIssue.parsedBody.hoster?.[0];

      if (!eventDate) {
        throw new LintError(["Drive Link: Cannot auto-create folder - Event Date is required"]);
      }

      if (!hoster) {
        throw new LintError(["Drive Link: Cannot auto-create folder - Hoster is required"]);
      }

      try {
        // Auto-create the Google Drive folder
        const result = await this.googleDriveService.createMeetupFolder(
          meetupIssue.number,
          eventDate,
          hoster
        );

        // Update the meetup issue with the new drive link
        meetupIssue.parsedBody.drive_link = result.url;
        this.meetupIssueService.updateMeetupIssueBodyField(meetupIssue, "drive_link");

        return meetupIssue;
      } catch (error) {
        throw new LintError([
          `Drive Link: Failed to auto-create folder - ${(error as Error).message}`,
        ]);
      }
    }
  }

  protected getLinkRegex() {
    return DriveLinkLinterAdapter.DRIVE_LINK_REGEX;
  }

  protected getErrorMessage() {
    return "Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j";
  }

  protected getFieldName() {
    return "drive_link" as const;
  }
}
