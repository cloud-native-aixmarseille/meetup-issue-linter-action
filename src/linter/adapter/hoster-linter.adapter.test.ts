import { mock, MockProxy } from "jest-mock-extended";
import { InputService } from "../../services/input.service.js";
import { HosterLinterAdapter } from "./hoster-linter.adapter.js";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";
import { getHostersFixture } from "../../__fixtures__/hosters.fixture.js";
import { LintError } from "../lint.error.js";
import { MeetupIssueService } from "../../services/meetup-issue.service.js";

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
          hoster,
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
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(resultWithLink.parsedBody.hoster).toEqual([hoster]);
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
