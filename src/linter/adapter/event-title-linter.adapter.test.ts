import { EventTitleLinterAdapter } from "./event-title-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { MockProxy, mock } from "jest-mock-extended";
import { MeetupIssueService } from "../../services/meetup-issue.service";

describe("EventTitleLinterAdapter", () => {
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let eventTitleLinterAdapter: EventTitleLinterAdapter;

  beforeEach(() => {
    meetupIssueService = mock<MeetupIssueService>();

    eventTitleLinterAdapter = new EventTitleLinterAdapter(meetupIssueService);
  });

  describe("lint", () => {
    it("should return the meetup issue if the event title is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await eventTitleLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(result).toEqual(meetupIssue);
    });

    it.each([
      {
        description: "event title is empty",
        event_title: "",
        error: "Must not be empty",
      },
    ])("should throw a LintError if $description", async ({ event_title, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody: {
          event_title,
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Event Title: ${error}`]);

      await expect(
        eventTitleLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);

      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = eventTitleLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
