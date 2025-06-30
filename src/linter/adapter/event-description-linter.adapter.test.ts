import { EventDescriptionLinterAdapter } from "./event-description-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { MockProxy, mock } from "jest-mock-extended";
import { MeetupIssueService } from "../../services/meetup-issue.service";

describe("EventDescriptionLinterAdapter", () => {
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let eventDescriptionLinterAdapter: EventDescriptionLinterAdapter;

  beforeEach(() => {
    meetupIssueService = mock<MeetupIssueService>();

    eventDescriptionLinterAdapter = new EventDescriptionLinterAdapter(meetupIssueService);
  });

  describe("lint", () => {
    it("should return the meetup issue if the event description is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await eventDescriptionLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(result).toEqual(meetupIssue);
    });

    it.each([
      {
        description: "event description is empty",
        event_description: "",
        error: "Must not be empty",
      },
    ])("should throw a LintError if $description", async ({ event_description, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody: {
          event_description,
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Event Description: ${error}`]);

      await expect(
        eventDescriptionLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);

      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = eventDescriptionLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
