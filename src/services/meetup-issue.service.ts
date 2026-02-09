import { inject, injectable } from "inversify";
import {
  GitHubService,
  UpdatableGithubIssue,
  UpdatableGithubIssueFields,
} from "./github.service.js";
import { HosterWithUrl, SpeakerWithUrl } from "./input.service.js";

export type MeetupIssueBodyFields = keyof MeetupIssueBody;

export type DriveFileKey = string;

export type DriveFiles = {
  [key: DriveFileKey]: string;
};

export type MeetupIssueBody = {
  event_date?: string;
  event_title?: string;
  hoster?: string[];
  event_description?: string;
  agenda?: string;
  meetup_link?: string;
  cncf_link?: string;
  drive_link?: string;
};

export type MeetupIssue = {
  number: number;
  title?: string;
  body: string;
  parsedBody: MeetupIssueBody;
  labels: string[];
  hoster?: HosterWithUrl;
  speakers?: SpeakerWithUrl[];
  driveFiles?: DriveFiles;
};

export const MEETUP_ISSUE_BODY_FIELD_LABELS: Record<MeetupIssueBodyFields, string> = {
  event_date: "Event Date",
  event_title: "Event Title",
  hoster: "Hoster",
  event_description: "Event Description",
  agenda: "Agenda",
  meetup_link: "Meetup Link",
  cncf_link: "CNCF Link",
  drive_link: "Drive Link",
};

@injectable()
export class MeetupIssueService {
  constructor(@inject(GitHubService) private readonly githubService: GitHubService) {}

  async getMeetupIssue(
    issueNumber: number,
    issueParsedBody: MeetupIssueBody
  ): Promise<MeetupIssue> {
    const { number, title, labels, body } = await this.githubService.getIssue(issueNumber);

    const meetupIssue: MeetupIssue = {
      number,
      title,
      labels,
      body,
      parsedBody: issueParsedBody,
    };

    return meetupIssue;
  }

  async updateMeetupIssue(originalIssue: MeetupIssue, updatedIssue: MeetupIssue): Promise<void> {
    if (originalIssue.number !== updatedIssue.number) {
      throw new Error("Issue number mismatch");
    }

    const issueFieldsToUpdate: UpdatableGithubIssue = {};

    // Helper function to safely assign field values with proper type narrowing
    const assignFieldIfChanged = <K extends keyof UpdatableGithubIssue>(
      field: K,
      originalValue: unknown,
      updatedValue: unknown
    ): void => {
      if (!this.areValuesEqual(originalValue, updatedValue)) {
        issueFieldsToUpdate[field] = updatedValue as UpdatableGithubIssue[K];
      }
    };

    for (const field of UpdatableGithubIssueFields) {
      assignFieldIfChanged(field, originalIssue[field], updatedIssue[field]);
    }

    if (Object.keys(issueFieldsToUpdate).length === 0) {
      return;
    }

    await this.githubService.updateIssue(originalIssue.number, issueFieldsToUpdate);
  }

  updateMeetupIssueBodyField(meetupIssue: MeetupIssue, field: MeetupIssueBodyFields): void {
    if (!Object.keys(MEETUP_ISSUE_BODY_FIELD_LABELS).includes(field)) {
      throw new Error(`Invalid field: ${field}`);
    }

    let body = meetupIssue.body;

    // Find the field in the body
    const fieldRegex = new RegExp(
      `### ${MEETUP_ISSUE_BODY_FIELD_LABELS[field]}\\s*\\n(.*?)(?=\\n###|$)`,
      "s"
    );
    const match = body.match(fieldRegex);

    if (!match) {
      throw new Error(`Field "${field}" not found in issue body`);
    }

    let newValue = meetupIssue.parsedBody[field] || "";

    if (Array.isArray(newValue)) {
      // If the field is an array, join it with a semicolon and a space
      newValue = newValue.join(", ");
    }

    body = body.replace(
      fieldRegex,
      `### ${MEETUP_ISSUE_BODY_FIELD_LABELS[field]}\n\n${newValue.trim()}\n`
    );

    meetupIssue.body = body;
  }

  private areValuesEqual(valueA: unknown, valueB: unknown): boolean {
    if (Array.isArray(valueA) || Array.isArray(valueB)) {
      return JSON.stringify(valueA) === JSON.stringify(valueB);
    }

    return valueA === valueB;
  }
}
