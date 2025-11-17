import { DriveLinkLinterAdapter } from "./drive-link-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { MockProxy, mock } from "jest-mock-extended";
import { MeetupIssueService } from "../../services/meetup-issue.service";
import { GoogleDriveService } from "../../services/google-drive/google-drive.service";
import { EventDateLinterAdapter } from "./event-date-linter.adapter";
import { HosterLinterAdapter } from "./hoster-linter.adapter";

describe("DriveLinkLinterAdapter", () => {
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let googleDriveService: MockProxy<GoogleDriveService>;
  let driveLinkLinterAdapter: DriveLinkLinterAdapter;

  beforeEach(() => {
    meetupIssueService = mock<MeetupIssueService>();
    googleDriveService = mock<GoogleDriveService>();

    driveLinkLinterAdapter = new DriveLinkLinterAdapter(meetupIssueService, googleDriveService);
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
          "Invalid URL; Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
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

    it("should auto-create Google Drive folder when missing drive link and Google Drive is configured", async () => {
      // Arrange
      googleDriveService.createMeetupFolder.mockResolvedValue({
        id: "new-folder-id",
        url: "https://drive.google.com/drive/folders/new-folder-id",
      });

      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: undefined,
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const shouldFix = true;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(googleDriveService.createMeetupFolder).toHaveBeenCalledWith(
        meetupIssue.number,
        "2024-12-15",
        "Test Hoster"
      );
      expect(meetupIssueService.updateMeetupIssueBodyField).toHaveBeenCalledWith(
        meetupIssue,
        "drive_link"
      );
      expect(result.parsedBody.drive_link).toBe(
        "https://drive.google.com/drive/folders/new-folder-id"
      );
    });

    it("should throw error when trying to auto-create without event_date", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: undefined,
          event_date: undefined,
          hoster: ["Test Hoster"],
        },
      });
      const shouldFix = true;

      // Act & Assert
      const expectedError = new LintError([
        "Drive Link: Cannot auto-create folder - Event Date is required",
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveService.createMeetupFolder).not.toHaveBeenCalled();
    });

    it("should throw error when trying to auto-create without hoster", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: undefined,
          event_date: "2024-12-15",
          hoster: undefined,
        },
      });
      const shouldFix = true;

      // Act & Assert
      const expectedError = new LintError([
        "Drive Link: Cannot auto-create folder - Hoster is required",
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveService.createMeetupFolder).not.toHaveBeenCalled();
    });

    it("should not auto-create when shouldFix is false", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: undefined,
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        "Drive Link: Invalid input: expected string, received undefined",
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveService.createMeetupFolder).not.toHaveBeenCalled();
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = driveLinkLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([EventDateLinterAdapter, HosterLinterAdapter]);
    });
  });
});
