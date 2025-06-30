import { DriveLinkLinterAdapter } from "./drive-link-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { MockProxy, mock } from "jest-mock-extended";
import { MeetupIssueService } from "../../services/meetup-issue.service";

describe("DriveLinkLinterAdapter", () => {
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let driveLinkLinterAdapter: DriveLinkLinterAdapter;

  beforeEach(() => {
    meetupIssueService = mock<MeetupIssueService>();

    driveLinkLinterAdapter = new DriveLinkLinterAdapter(meetupIssueService);
  });

  describe("lint", () => {
    it("should return the meetup issue if the Drive Link is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(result).toEqual(meetupIssue);
    });

    it.each([
      {
        description: "Drive Link is invalid",
        drive_link: "invalid-link",
        error:
          "Invalid url; Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
      },
      {
        description: "Drive Link is not a Drive Link",
        drive_link: "https://www.google.com",
        error:
          "Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
      },
    ])("should throw a LintError if $description", async ({ drive_link, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link,
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Drive Link: ${error}`]);

      await expect(
        driveLinkLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);

      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
    });

    it("should accept Drive Link with trailing slash", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j/",
        },
      });
      const shouldFix = false;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
      expect(result).toEqual(meetupIssue);
    });

    it("should remove trailing slash when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j/",
        },
      });
      const shouldFix = true;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).toHaveBeenCalledWith(
        meetupIssue,
        "drive_link"
      );
      expect(result.parsedBody.drive_link).toBe(
        "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j"
      );
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = driveLinkLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
