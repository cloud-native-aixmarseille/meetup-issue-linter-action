import { MeetupLinkLinterAdapter } from "./meetup-link-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { MockProxy, mock } from "jest-mock-extended";
import { MeetupIssueService } from "../../services/meetup-issue.service";

describe("MeetupLinkLinterAdapter", () => {
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let meetupLinkLinterAdapter: MeetupLinkLinterAdapter;

  beforeEach(() => {
    meetupIssueService = mock<MeetupIssueService>();

    meetupLinkLinterAdapter = new MeetupLinkLinterAdapter(meetupIssueService);
  });

  describe("lint", () => {
    it("should return the meetup issue if the Meetup link is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await meetupLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(result).toEqual(meetupIssue);
    });

    it.each([
      {
        description: "Meetup link is invalid",
        meetup_link: "invalid-link",
        error:
          "Invalid url; Must be a valid Meetup link, e.g. https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
      },
      {
        description: "Meetup link is not a Meetup link",
        meetup_link: "https://www.google.com",
        error:
          "Must be a valid Meetup link, e.g. https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
      },
    ])("should throw a LintError if $description", async ({ meetup_link, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody: {
          meetup_link,
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Meetup Link: ${error}`]);

      await expect(
        meetupLinkLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);

      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
    });

    it("should accept Meetup Link with trailing slash", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          meetup_link: "https://www.meetup.com/cloud-native-aix-marseille/events/123456789/",
        },
      });
      const shouldFix = false;

      // Act
      const result = await meetupLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(result).toEqual(meetupIssue);
    });

    it("should remove trailing slash when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          meetup_link: "https://www.meetup.com/cloud-native-aix-marseille/events/123456789/",
        },
      });
      const shouldFix = true;

      // Act
      const result = await meetupLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).toHaveBeenCalledWith(
        meetupIssue,
        "meetup_link"
      );
      expect(result.parsedBody.meetup_link).toBe(
        "https://www.meetup.com/cloud-native-aix-marseille/events/123456789"
      );
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = meetupLinkLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
