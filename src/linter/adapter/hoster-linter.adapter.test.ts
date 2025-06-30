import { mock, MockProxy } from "jest-mock-extended";
import { InputService } from "../../services/input.service";
import { HosterLinterAdapter } from "./hoster-linter.adapter";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { getHostersFixture } from "../../__fixtures__/hosters.fixture";
import { LintError } from "../lint.error";
import { MeetupIssueService } from "../../services/meetup-issue.service";

describe("HosterLinterAdapter", () => {
  let inputServiceMock: MockProxy<InputService>;
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let hosterLinterAdapter: HosterLinterAdapter;

  beforeEach(() => {
    inputServiceMock = mock<InputService>();
    inputServiceMock.getHosters.mockReturnValue(getHostersFixture());

    meetupIssueService = mock<MeetupIssueService>();

    hosterLinterAdapter = new HosterLinterAdapter(meetupIssueService, inputServiceMock);
  });

  describe("lint", () => {
    it("should validate a single hoster entry successfully", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();

      // Act
      const result = await hosterLinterAdapter.lint(meetupIssue, false);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(result).toEqual(meetupIssue);
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
          hoster: hoster,
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Hoster: ${error}`]);

      await expect(hosterLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
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
      expect(meetupIssueService.updateMeetupIssueBodyField).toHaveBeenCalledWith(
        meetupIssue,
        "hoster"
      );
      expect(result.parsedBody.hoster).toEqual([`[${hosters[0].name}](${hosters[0].url})`]);
    });

    it("should handle mixed scenarios with hoster having link and without link", async () => {
      // Arrange
      const hosters = getHostersFixture();

      // Test with hoster that already has a link
      const meetupIssueWithLink = getMeetupIssueFixture({
        parsedBody: {
          hoster: [`[${hosters[0].name}](${hosters[0].url})`], // Already has link
        },
      });
      const shouldFix = false;

      // Act
      const resultWithLink = await hosterLinterAdapter.lint(meetupIssueWithLink, shouldFix);

      // Assert - should add link even when shouldFix is false if it doesn't have one
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(resultWithLink.parsedBody.hoster).toEqual([`[${hosters[0].name}](${hosters[0].url})`]);

      // Test with hoster that doesn't have a link
      const meetupIssueWithoutLink = getMeetupIssueFixture({
        parsedBody: {
          hoster: [hosters[0].name], // Plain name without link
        },
      });

      // Act
      const resultWithoutLink = await hosterLinterAdapter.lint(meetupIssueWithoutLink, shouldFix);

      // Assert - should add link even when shouldFix is false if it doesn't have one
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(resultWithoutLink.parsedBody.hoster).toEqual([
        `[${hosters[0].name}](${hosters[0].url})`,
      ]);
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
