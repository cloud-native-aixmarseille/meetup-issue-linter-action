import { DriveLinkLinterAdapter } from "./drive-link-linter.adapter.js";
import { LintError } from "../lint.error.js";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";
import { MockProxy, mock } from "jest-mock-extended";
import { EventDateLinterAdapter } from "./event-date-linter.adapter.js";
import { HosterLinterAdapter } from "./hoster-linter.adapter.js";
import { GoogleDriveFolderService } from "../../services/google-drive/google-drive-folder.service.js";
import {
  FileTemplateResult,
  GoogleDriveTemplateService,
} from "../../services/google-drive/google-drive-template.service.js";

describe("DriveLinkLinterAdapter", () => {
  let googleDriveFolderService: MockProxy<GoogleDriveFolderService>;
  let googleDriveTemplateService: MockProxy<GoogleDriveTemplateService>;
  let driveLinkLinterAdapter: DriveLinkLinterAdapter;

  const getExpectedFolderName = (eventDate: string, hoster: string) => {
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
      new Date(`${eventDate}T00:00:00`)
    );

    return `${eventDate} - ${month} - ${hoster}`;
  };

  beforeEach(() => {
    googleDriveFolderService = mock<GoogleDriveFolderService>();
    googleDriveTemplateService = mock<GoogleDriveTemplateService>();

    driveLinkLinterAdapter = new DriveLinkLinterAdapter(
      googleDriveFolderService,
      googleDriveTemplateService
    );
  });

  const mockTemplateHappyPath = (eventDate: string, templateId: string) => {
    const templateFiles: FileTemplateResult[] = [
      { id: "tpl-1", name: "Agenda [EVENT_DATE:YYYY-MM-DD].md", templateKind: "agenda" },
    ];
    const expectedFileName = `Agenda ${eventDate}.md`;

    googleDriveTemplateService.getTemplateFiles.mockResolvedValue(templateFiles);
    googleDriveTemplateService.findByTemplateId.mockResolvedValue({
      id: templateId,
      name: expectedFileName,
      templateKind: "agenda",
      url: `https://drive.google.com/file/d/${templateId}`,
    });

    return { templateFiles, expectedFileName };
  };

  describe("lint", () => {
    it("returns the meetup issue when the Drive Link is valid and folder matches", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
        number: 42,
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );

      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });
      mockTemplateHappyPath(meetupIssue.parsedBody.event_date!, "existing-id");
      const shouldFix = false;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
      expect(result.driveFiles).toEqual({
        "agenda-link": `https://drive.google.com/file/d/existing-id`,
      });
      expect(googleDriveFolderService.getFolder).toHaveBeenCalledWith(meetupIssue.number);
      expect(googleDriveFolderService.createFolder).not.toHaveBeenCalled();
      expect(googleDriveFolderService.updateFolderName).not.toHaveBeenCalled();
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
      const expectedError = new LintError([
        { field: "parsedBody.drive_link", value: drive_link, message: `Drive Link: ${error}` },
      ]);

      await expect(
        driveLinkLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);

      expect(googleDriveFolderService.getFolder).not.toHaveBeenCalled();
    });

    it("should accept Drive Link with trailing slash", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j/",
          event_date: "2024-11-20",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "folder-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });
      mockTemplateHappyPath(meetupIssue.parsedBody.event_date!, "folder-id");
      const shouldFix = false;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should remove trailing slash when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j/",
          event_date: "2024-11-20",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "folder-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });
      mockTemplateHappyPath(meetupIssue.parsedBody.event_date!, "folder-id");
      const shouldFix = true;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result.parsedBody.drive_link).toBe(
        "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j"
      );
    });

    it("auto-creates a Google Drive folder when none exists and shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/placeholder",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
        number: 7,
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue(null);
      googleDriveFolderService.createFolder.mockResolvedValue({
        id: "new-folder-id",
        url: "https://drive.google.com/drive/folders/new-folder-id",
        name: expectedFolderName,
      });
      mockTemplateHappyPath(meetupIssue.parsedBody.event_date!, "new-folder-id");
      const shouldFix = true;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(googleDriveFolderService.getFolder).toHaveBeenCalledWith(meetupIssue.number);
      expect(googleDriveFolderService.createFolder).toHaveBeenCalledWith(
        meetupIssue.number,
        expectedFolderName
      );
      expect(result.parsedBody.drive_link).toBe(
        "https://drive.google.com/drive/folders/new-folder-id"
      );
      expect(googleDriveFolderService.updateFolderName).not.toHaveBeenCalled();
    });

    it("throws when folder is missing and shouldFix is false", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/placeholder",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      googleDriveFolderService.getFolder.mockResolvedValue(null);
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message: "Drive Link: Folder does not exist on Google Drive for meetup issue #1",
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveFolderService.createFolder).not.toHaveBeenCalled();
      expect(googleDriveFolderService.updateFolderName).not.toHaveBeenCalled();
    });

    it("throws when folder name mismatches and shouldFix is false", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: "Old Name",
      });
      mockTemplateHappyPath(meetupIssue.parsedBody.event_date!, "existing-id");
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message: `Drive Link: Folder name mismatch. Expected: "${expectedFolderName}", Found: "Old Name"`,
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveFolderService.updateFolderName).not.toHaveBeenCalled();
    });

    it("updates folder name when mismatching and shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: "Old Name",
      });
      googleDriveFolderService.updateFolderName.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });
      mockTemplateHappyPath(meetupIssue.parsedBody.event_date!, "existing-id");
      const shouldFix = true;

      // Act & Assert
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      expect(googleDriveFolderService.updateFolderName).toHaveBeenCalledWith(
        "existing-id",
        expectedFolderName
      );
      expect(result.parsedBody.drive_link).toBe(meetupIssue.parsedBody.drive_link);
    });

    it("throws error when trying to auto-create without event_date", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/placeholder",
          event_date: undefined,
          hoster: ["Test Hoster"],
        },
      });
      const shouldFix = true;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message: "Drive Link: Cannot auto-create folder - Event Date is required",
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveFolderService.getFolder).not.toHaveBeenCalled();
    });

    it("throws error when trying to auto-create without hoster", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/placeholder",
          event_date: "2024-12-15",
          hoster: undefined,
        },
      });
      const shouldFix = true;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message: "Drive Link: Cannot auto-create folder - Hoster is required",
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveFolderService.getFolder).not.toHaveBeenCalled();
    });

    it("throws when event_date contains only whitespace", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/placeholder",
          event_date: "   ",
          hoster: ["Test Hoster"],
        },
      });

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message: "Drive Link: Event date is required",
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, true)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveFolderService.getFolder).not.toHaveBeenCalled();
      expect(googleDriveFolderService.createFolder).not.toHaveBeenCalled();
      expect(googleDriveFolderService.updateFolderName).not.toHaveBeenCalled();
    });

    it("throws when hoster contains only whitespace", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/placeholder",
          event_date: "2024-12-15",
          hoster: ["   "],
        },
      });

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message: "Drive Link: Hosting name is required",
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, true)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveFolderService.getFolder).not.toHaveBeenCalled();
      expect(googleDriveFolderService.createFolder).not.toHaveBeenCalled();
      expect(googleDriveFolderService.updateFolderName).not.toHaveBeenCalled();
    });

    it("throws when no template files are found", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
        number: 10,
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });
      googleDriveTemplateService.getTemplateFiles.mockResolvedValue([]);

      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message: "Drive Link: No template files found for Google Drive folder linting.",
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("throws when template file missing and shouldFix is false", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });

      const templateFiles: FileTemplateResult[] = [
        { id: "tpl-1", name: "Agenda [EVENT_DATE:YYYY-MM-DD].md", templateKind: "agenda" },
      ];
      googleDriveTemplateService.getTemplateFiles.mockResolvedValue(templateFiles);
      googleDriveTemplateService.findByTemplateId.mockResolvedValue(null);

      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message:
            'Drive Link: Missing file for template ID tpl-1 in folder "' + expectedFolderName + '"',
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveTemplateService.copyTemplateFile).not.toHaveBeenCalled();
    });

    it("copies missing template file when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });

      const templateFiles: FileTemplateResult[] = [
        { id: "tpl-1", name: "Agenda [EVENT_DATE:YYYY-MM-DD].md", templateKind: "agenda" },
      ];
      googleDriveTemplateService.getTemplateFiles.mockResolvedValue(templateFiles);
      googleDriveTemplateService.findByTemplateId.mockResolvedValue(null);
      googleDriveTemplateService.copyTemplateFile.mockResolvedValue({
        id: "copied-id",
        name: "Agenda 2024-12-15.md",
        templateKind: "agenda",
      });

      const shouldFix = true;

      // Act
      await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(googleDriveTemplateService.copyTemplateFile).toHaveBeenCalledWith(
        templateFiles[0],
        "existing-id",
        "Agenda 2024-12-15.md"
      );
    });

    it("throws when template filename mismatches and shouldFix is false", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });

      const templateFiles: FileTemplateResult[] = [
        { id: "tpl-1", name: "Agenda [EVENT_DATE:YYYY-MM-DD].md", templateKind: "agenda" },
      ];
      googleDriveTemplateService.getTemplateFiles.mockResolvedValue(templateFiles);
      googleDriveTemplateService.findByTemplateId.mockResolvedValue({
        id: "file-1",
        name: "Wrong name.md",
        templateKind: "agenda",
      });

      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message:
            'Drive Link: File name mismatch for template ID tpl-1. Expected: "Agenda 2024-12-15.md", Found: "Wrong name.md"',
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(googleDriveTemplateService.updateName).not.toHaveBeenCalled();
    });

    it("renames mismatching template file when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });

      const templateFiles: FileTemplateResult[] = [
        { id: "tpl-1", name: "Agenda [EVENT_DATE:YYYY-MM-DD].md", templateKind: "agenda" },
      ];
      googleDriveTemplateService.getTemplateFiles.mockResolvedValue(templateFiles);
      googleDriveTemplateService.findByTemplateId.mockResolvedValue({
        id: "file-1",
        name: "Wrong name.md",
        templateKind: "agenda",
      });
      googleDriveTemplateService.updateName.mockResolvedValue({
        id: "file-1",
        name: "Agenda 2024-12-15.md",
        templateKind: "agenda",
      });

      const shouldFix = true;

      // Act
      await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(googleDriveTemplateService.updateName).toHaveBeenCalledWith(
        { id: "file-1", name: "Wrong name.md", templateKind: "agenda" },
        "Agenda 2024-12-15.md"
      );
    });

    it("throws when template kind mismatches", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });

      const templateFiles: FileTemplateResult[] = [
        { id: "tpl-1", name: "Agenda [EVENT_DATE:YYYY-MM-DD].md", templateKind: "agenda" },
      ];
      googleDriveTemplateService.getTemplateFiles.mockResolvedValue(templateFiles);
      googleDriveTemplateService.findByTemplateId.mockResolvedValue({
        id: "file-1",
        name: "Agenda 2024-12-15.md",
        templateKind: "slides",
      });

      googleDriveTemplateService.updateTemplateKind.mockResolvedValue({
        id: "file-1",
        name: "Agenda 2024-12-15.md",
        templateKind: "agenda",
      });

      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        {
          field: "parsedBody.drive_link",
          value: meetupIssue.parsedBody.drive_link,
          message:
            'Drive Link: Template kind mismatch for template ID tpl-1. Expected: "agenda", Found: "slides"',
        },
      ]);

      await expect(driveLinkLinterAdapter.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("fixes template kind when allowed", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        parsedBody: {
          drive_link: "https://drive.google.com/drive/folders/existing-id",
          event_date: "2024-12-15",
          hoster: ["Test Hoster"],
        },
      });
      const expectedFolderName = getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      );
      googleDriveFolderService.getFolder.mockResolvedValue({
        id: "existing-id",
        url: meetupIssue.parsedBody.drive_link!,
        name: expectedFolderName,
      });

      const templateFiles: FileTemplateResult[] = [
        { id: "tpl-1", name: "Agenda [EVENT_DATE:YYYY-MM-DD].md", templateKind: "agenda" },
      ];
      googleDriveTemplateService.getTemplateFiles.mockResolvedValue(templateFiles);
      googleDriveTemplateService.findByTemplateId.mockResolvedValue({
        id: "file-1",
        name: "Agenda 2024-12-15.md",
        templateKind: "slides",
      });
      googleDriveTemplateService.updateTemplateKind.mockResolvedValue({
        id: "file-1",
        name: "Agenda 2024-12-15.md",
        templateKind: "agenda",
      });

      const shouldFix = true;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(googleDriveTemplateService.updateTemplateKind).toHaveBeenCalledWith(
        {
          id: "file-1",
          name: "Agenda 2024-12-15.md",
          templateKind: "slides",
        },
        templateFiles[0]
      );
      expect(result).toEqual(meetupIssue);
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
