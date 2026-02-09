import { EventTitleLinterAdapter } from "./event-title-linter.adapter.js";
import { LintError } from "../lint.error.js";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";

describe("EventTitleLinterAdapter", () => {
  let eventTitleLinterAdapter: EventTitleLinterAdapter;

  beforeEach(() => {
    eventTitleLinterAdapter = new EventTitleLinterAdapter();
  });

  describe("lint", () => {
    it("should return the meetup issue if the event title is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await eventTitleLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
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
