import { MeetupLinkLinterAdapter } from "./meetup-link-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";

describe("MeetupLinkLinterAdapter", () => {
  let meetupLinkLinterAdapter: MeetupLinkLinterAdapter;

  beforeEach(() => {
    meetupLinkLinterAdapter = new MeetupLinkLinterAdapter();
  });

  describe("lint", () => {
    it("should return the meetup issue if the Meetup link is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await meetupLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should throw a LintError if the Meetup link is invalid", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          meetup_link: "invalid-link",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        "Meetup Link: Invalid url; Must be a valid Meetup link, e.g. https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
      ]);

      await expect(
        meetupLinkLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);
    });

    it("should throw a LintError if the Meetup link is not a Meetup link", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          meetup_link: "https://www.google.com",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        "Meetup Link: Must be a valid Meetup link, e.g. https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
      ]);

      await expect(
        meetupLinkLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);
    });

    it("should accept Meetup Link with trailing slash", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        body: {
          meetup_link: "https://www.meetup.com/cloud-native-aix-marseille/events/123456789/",
        },
      });
      const shouldFix = false;

      // Act
      const result = await meetupLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should remove trailing slash when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        body: {
          meetup_link: "https://www.meetup.com/cloud-native-aix-marseille/events/123456789/",
        },
      });
      const shouldFix = true;

      // Act
      const result = await meetupLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result.body.meetup_link).toBe(
        "https://www.meetup.com/cloud-native-aix-marseille/events/123456789"
      );
    });
  });
});
