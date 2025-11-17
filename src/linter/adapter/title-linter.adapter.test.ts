import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";
import { TitleLinterAdapter } from "./title-linter.adapter.js";
import { LintError } from "../lint.error.js";

describe("TitleLinterAdapter", () => {
  let titleLinterAdapter: TitleLinterAdapter;

  beforeEach(() => {
    titleLinterAdapter = new TitleLinterAdapter();
  });

  describe("lint", () => {
    it("should return the meetup issue if the title matches the expected format", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        title: "[Meetup] - 2021-12-31 - December - Meetup Event",
      });
      const shouldFix = false;

      // Act
      const result = await titleLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toBe(meetupIssue);
    });

    it.each([
      {
        description: "title is invalid",
        title: "Wrong Title",
        error: 'Invalid, expected "[Meetup] - 2021-12-31 - December - Meetup Event"',
      },
    ])("should throw a LintError if $description", async ({ title, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        title,
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        { field: "title", value: title, message: `Title: ${error}` },
      ]);

      await expect(titleLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should fix the title if it is invalid and shouldFix is true", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        title: "Wrong Title",
      });
      const shouldFix = true;

      // Act
      const result = await titleLinterAdapter.lint(invalidMeetupIssue, shouldFix);

      // Assert
      expect(result.title).toBe("[Meetup] - 2021-12-31 - December - Meetup Event");
    });

    it.each([
      {
        description: "there is no event_date",
        parsedBody: { event_date: undefined },
        error: "Event Date is required to lint the title",
      },
      {
        description: "there is no event_title",
        parsedBody: { event_date: "2021-12-31", event_title: undefined },
        error: "Event Title is required to lint the title",
      },
    ])("should throw an error if $description", async ({ parsedBody, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody,
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new Error(error);

      await expect(titleLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });
  });

  describe("getDependencies", () => {
    it("should return a non-empty array", () => {
      // Act
      const result = titleLinterAdapter.getDependencies();

      // Assert
      expect(result).toBeTruthy();
    });
  });
});
