import { ValidMeetupIssueOutputService } from "./valid-meetup-issue-output.service";
import { getMeetupIssueFixture } from "../__fixtures__/meetup-issue.fixture";
import { getHostersFixture } from "../__fixtures__/hosters.fixture";
import { getSpeakersFixture } from "../__fixtures__/speakers.fixture";
import { LintIssue } from "../linter/lint.error";

describe("ValidMeetupIssueOutputService", () => {
  const service = new ValidMeetupIssueOutputService();

  it("returns the meetup issue payload as-is", async () => {
    const meetupIssue = getMeetupIssueFixture({
      hoster: getHostersFixture()[0],
      speakers: getSpeakersFixture(),
      driveFiles: { agenda: "https://drive.google.com/file/d/agenda" },
    });

    const result = await service.build(meetupIssue);

    expect(result).toEqual({
      number: meetupIssue.number,
      title: meetupIssue.title,
      labels: meetupIssue.labels,
      hoster: meetupIssue.hoster,
      speakers: meetupIssue.speakers,
      "parsed-body": meetupIssue.parsedBody,
      "drive-files": meetupIssue.driveFiles,
    });
  });

  it("removes fields flagged by lint issues", async () => {
    const meetupIssue = getMeetupIssueFixture();

    const lintIssues: LintIssue[] = [
      { field: "parsedBody.agenda", message: "Agenda invalid" },
      { field: "labels", message: "Labels invalid" },
      { field: "title", message: "Title invalid" },
    ];

    const result = await service.build(meetupIssue, lintIssues);

    expect(result.title).toBeUndefined();
    expect(result.labels).toBeUndefined();
    expect(result["parsed-body"].agenda).toBeUndefined();
    expect(result["parsed-body"].event_date).toBeDefined();
  });
});
