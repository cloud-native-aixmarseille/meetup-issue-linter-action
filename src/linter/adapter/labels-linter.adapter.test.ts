import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";
import { LabelsLinterAdapter } from "./labels-linter.adapter.js";
import { LintError } from "../lint.error.js";

describe("LabelsLinterAdapter - lint", () => {
  let labelsLinterAdapter: LabelsLinterAdapter;

  beforeEach(() => {
    labelsLinterAdapter = new LabelsLinterAdapter();
  });

  describe("lint", () => {
    it("should return the meetupIssue as is if the labels matches the expected labels", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        labels: ["meetup", "hoster:confirmed"],
      });
      const shouldFix = false;

      // Act
      const result = await labelsLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toBe(meetupIssue);
    });

    it("should expect hoster needed label when hoster is empty", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        labels: ["meetup"],
        parsedBody: {
          hoster: [],
        },
      });
      const shouldFix = false;

      // Act
      const result = labelsLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      const expectedError = new LintError([`Labels: Missing label(s) "hoster:needed"`]);
      await expect(result).rejects.toStrictEqual(expectedError);
    });

    it("should expect hoster confirmed label when hoster is not empty", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        labels: ["meetup"],
      });
      const shouldFix = false;

      // Act
      const result = labelsLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      const expectedError = new LintError([`Labels: Missing label(s) "hoster:confirmed"`]);
      await expect(result).rejects.toStrictEqual(expectedError);
    });

    it("should expect speaker needed label when agenda empty", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        labels: ["meetup", "hoster:confirmed"],
        parsedBody: {
          agenda: "",
        },
      });
      const shouldFix = false;

      // Act
      const result = labelsLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      const expectedError = new LintError(['Labels: Missing label(s) "speakers:needed"']);
      await expect(result).rejects.toStrictEqual(expectedError);
    });

    it.each([
      {
        description: "some label is missing and shouldFix is false",
        labels: ["Wrong Label"],
        errors: ['Missing label(s) "meetup, hoster:confirmed"', 'Extra label(s) "Wrong Label"'],
      },
      {
        description: "some label is extra and shouldFix is false",
        labels: ["meetup", "hoster:confirmed", "Extra Label"],
        errors: ['Extra label(s) "Extra Label"'],
      },
    ])("should throw a LintError if $description", async ({ labels, errors }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        labels,
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError(errors.map((error) => `Labels: ${error}`));

      await expect(labelsLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should fix the labels if it is invalid and shouldFix is true", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        labels: ["Wrong Label"],
      });
      const shouldFix = true;

      // Act
      const result = await labelsLinterAdapter.lint(invalidMeetupIssue, shouldFix);

      // Assert
      expect(result.labels).toStrictEqual(["meetup", "hoster:confirmed"]);
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = labelsLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
