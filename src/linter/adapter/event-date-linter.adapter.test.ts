import { EventDateLinterAdapter } from "./event-date-linter.adapter.js";
import { LintError } from "../lint.error.js";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";

describe("EventDateLinterAdapter", () => {
  let eventDateLinterAdapter: EventDateLinterAdapter;

  beforeEach(() => {
    eventDateLinterAdapter = new EventDateLinterAdapter();
  });

  describe("lint", () => {
    it("should return the meetup issue if the event date is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await eventDateLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it.each([
      {
        description: "event date is invalid",
        event_date: "invalid-date",
        error: "Invalid ISO date",
      },
    ])("should throw a LintError if $description", async ({ event_date, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody: {
          event_date,
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Event Date: ${error}`]);

      await expect(
        eventDateLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = eventDateLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
