import { EventDescriptionLinterAdapter } from "./event-description-linter.adapter.js";
import { LintError } from "../lint.error.js";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";

describe("EventDescriptionLinterAdapter", () => {
  let eventDescriptionLinterAdapter: EventDescriptionLinterAdapter;

  beforeEach(() => {
    eventDescriptionLinterAdapter = new EventDescriptionLinterAdapter();
  });

  describe("lint", () => {
    it("should return the meetup issue if the event description is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await eventDescriptionLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
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
