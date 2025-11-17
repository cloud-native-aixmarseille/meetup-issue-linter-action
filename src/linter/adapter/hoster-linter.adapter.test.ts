import { mock, MockProxy } from "jest-mock-extended";
import { InputService } from "../../services/input.service.js";
import { HosterLinterAdapter } from "./hoster-linter.adapter.js";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";
import { getHostersFixture } from "../../__fixtures__/hosters.fixture.js";
import { LintError } from "../lint.error.js";

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
      expect(result.hoster).toEqual(getHostersFixture()[0]);
    });

    it.each([
      {
        description: "array is empty",
        hoster: [],
        error: "Must not be empty",
      },
      {
        description: "array has more than one item",
        hoster: [getHostersFixture()[0].name, getHostersFixture()[1].name],
        error: "Must have exactly one entry",
      },
      {
        description: "hoster is not in the list",
        hoster: ["Invalid Hoster"],
        error: '"Invalid Hoster" is not an existing hoster',
      },
    ])("should throw a LintError if $description", async ({ hoster, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody: {
          hoster,
        },
      });

      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Hoster: ${error}`]);

      await expect(hosterLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should add links to hoster when shouldFix is true", async () => {
      // Arrange
      const hosters = getHostersFixture();

      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          hoster: [hosters[0].name], // Plain name without link
        },
      });
      const shouldFix = true;

      // Act
      const result = await hosterLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result.parsedBody.hoster).toEqual([`[${hosters[0].name}](${hosters[0].url})`]);
      expect(result.hoster).toEqual(hosters[0]);
    });

    it("should be idempotent for hoster having link", async () => {
      // Arrange
      const hosters = getHostersFixture();
      const hoster = `[${hosters[0].name}](${hosters[0].url})`; // Hoster with link

      // Test with hoster that already has a link
      const meetupIssueWithLink = getMeetupIssueFixture({
        parsedBody: {
          hoster: [hoster],
        },
      });
      const shouldFix = true;

      // Act
      const resultWithLink = await hosterLinterAdapter.lint(meetupIssueWithLink, shouldFix);

      // Assert - should add link even when shouldFix is false if it doesn't have one
      expect(resultWithLink.parsedBody.hoster).toEqual([hoster]);
      expect(resultWithLink.hoster).toEqual(hosters[0]);
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = hosterLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
