import { injectable } from "inversify";
import { MeetupIssue } from "./meetup-issue.service.js";
import { type LintIssue } from "../linter/lint.error.js";

type DriveFileKey = string;

export type DriveFilesOutput = {
  [key: DriveFileKey]: string;
};

export type ValidMeetupIssueOutput = {
  number: MeetupIssue["number"];
  title?: MeetupIssue["title"];
  labels?: MeetupIssue["labels"];
  hoster?: MeetupIssue["hoster"];
  speakers?: MeetupIssue["speakers"];
  "parsed-body": MeetupIssue["parsedBody"];
  "drive-files"?: MeetupIssue["driveFiles"];
};

@injectable()
export class ValidMeetupIssueOutputService {
  async build(
    meetupIssue: MeetupIssue,
    lintIssues: LintIssue[] = []
  ): Promise<ValidMeetupIssueOutput> {
    const sanitizedParsedBody = { ...meetupIssue.parsedBody };
    let sanitizedTitle = meetupIssue.title;
    let sanitizedLabels: MeetupIssue["labels"] | undefined = meetupIssue.labels;

    for (const issue of lintIssues) {
      if (!issue.field) {
        continue;
      }

      if (issue.field === "title") {
        sanitizedTitle = undefined;
        continue;
      }

      if (issue.field === "labels") {
        sanitizedLabels = undefined;
        continue;
      }

      if (issue.field.startsWith("parsedBody.")) {
        const [, key] = issue.field.split(".");
        delete sanitizedParsedBody[key as keyof MeetupIssue["parsedBody"]];
      }
    }

    return {
      number: meetupIssue.number,
      title: sanitizedTitle,
      "parsed-body": sanitizedParsedBody,
      labels: sanitizedLabels,
      hoster: meetupIssue.hoster,
      speakers: meetupIssue.speakers,
      "drive-files": meetupIssue.driveFiles,
    };
  }
}
