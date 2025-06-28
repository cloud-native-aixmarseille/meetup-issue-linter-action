import { mock, MockProxy } from "jest-mock-extended";
import { InputService } from "../../services/input.service";
import { HosterLinterAdapter } from "./hoster-linter.adapter";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { getHostersFixture } from "../../__fixtures__/hosters.fixture";
import { LintError } from "../lint.error";

describe("HosterLinterAdapter", () => {
  let inputServiceMock: MockProxy<InputService>;
  let hosterLinterAdapter: HosterLinterAdapter;

  beforeEach(() => {
    inputServiceMock = mock<InputService>();
    inputServiceMock.getHosters.mockReturnValue(getHostersFixture());

    hosterLinterAdapter = new HosterLinterAdapter(inputServiceMock);
  });

  describe("lint", () => {
    it("should validate a single hoster entry successfully", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();

      // Act
      const result = await hosterLinterAdapter.lint(meetupIssue, false);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should fail validation if the array is empty", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          hoster: [],
        },
      });

      // Act & Assert
      const expectedError = new LintError(["Hoster: Must not be empty"]);
      await expect(() => hosterLinterAdapter.lint(invalidMeetupIssue, false)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should fail validation if the array has more than one item", async () => {
      // Arrange
      const hosters = getHostersFixture();
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          hoster: [hosters[0].name, hosters[1].name],
        },
      });

      // Act & Assert
      const expectedError = new LintError(["Hoster: Must have exactly one entry"]);
      await expect(() => hosterLinterAdapter.lint(invalidMeetupIssue, false)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should fail validation if the hoster is not in the list", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          hoster: ["invalidHoster"],
        },
      });

      // Act & Assert
      const expectedError = new LintError(['Hoster: "invalidHoster" is not an existing hoster']);
      await expect(() => hosterLinterAdapter.lint(invalidMeetupIssue, false)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should add links to hoster when shouldFix is true", async () => {
      // Arrange
      const hosters = getHostersFixture();

      const meetupIssue = getMeetupIssueFixture({
        body: {
          hoster: [hosters[0].name], // Plain name without link
        },
      });
      const shouldFix = true;

      // Act
      const result = await hosterLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result.body.hoster).toEqual([`[${hosters[0].name}](${hosters[0].url})`]);
    });

    it("should handle mixed scenarios with hoster having link and without link", async () => {
      // Arrange
      const hosters = getHostersFixture();

      // Test with hoster that already has a link
      const meetupIssueWithLink = getMeetupIssueFixture({
        body: {
          hoster: [`[${hosters[0].name}](${hosters[0].url})`], // Already has link
        },
      });
      const shouldFix = false;

      // Act
      const resultWithLink = await hosterLinterAdapter.lint(meetupIssueWithLink, shouldFix);

      // Assert - should add link even when shouldFix is false if it doesn't have one
      expect(resultWithLink.body.hoster).toEqual([`[${hosters[0].name}](${hosters[0].url})`]);

      // Test with hoster that doesn't have a link
      const meetupIssueWithoutLink = getMeetupIssueFixture({
        body: {
          hoster: [hosters[0].name], // Plain name without link
        },
      });

      // Act
      const resultWithoutLink = await hosterLinterAdapter.lint(meetupIssueWithoutLink, shouldFix);

      // Assert - should add link even when shouldFix is false if it doesn't have one
      expect(resultWithoutLink.body.hoster).toEqual([`[${hosters[0].name}](${hosters[0].url})`]);
    });
  });
});
