import { inject, injectable, injectFromBase } from "inversify";
import { AbstractLinkLinterAdapter } from "./abstract-link-linter.adapter.js";
import { MeetupIssue, type DriveFiles } from "../../services/meetup-issue.service.js";
import { LintError } from "../lint.error.js";
import { EventDateLinterAdapter } from "./event-date-linter.adapter.js";
import { HosterLinterAdapter } from "./hoster-linter.adapter.js";
import { LinterDependency } from "./linter.adapter.js";
import {
  GoogleDriveFolderResult,
  GoogleDriveFolderService,
} from "../../services/google-drive/google-drive-folder.service.js";
import {
  FileTemplateResult,
  GoogleDriveTemplateService,
} from "../../services/google-drive/google-drive-template.service.js";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class DriveLinkLinterAdapter extends AbstractLinkLinterAdapter {
  private static readonly DRIVE_LINK_REGEX =
    /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9-_]+\/?$/;

  constructor(
    @inject(GoogleDriveFolderService) private readonly folderService: GoogleDriveFolderService,
    @inject(GoogleDriveTemplateService) private readonly templateService: GoogleDriveTemplateService
  ) {
    super();
  }

  getDependencies(): LinterDependency[] {
    return [EventDateLinterAdapter, HosterLinterAdapter];
  }

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const result = await super.lint(meetupIssue, shouldFix);
    try {
      const driveFiles = await this.validateDriveLink(result, shouldFix);
      result.driveFiles = driveFiles;
      return result;
    } catch (error) {
      throw new LintError([
        {
          field: "parsedBody.drive_link",
          value: result.parsedBody.drive_link,
          message: `Drive Link: ${(error as Error).message}`,
        },
      ]);
    }
  }

  protected getLinkRegex() {
    return DriveLinkLinterAdapter.DRIVE_LINK_REGEX;
  }

  protected getErrorMessage() {
    return "Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j";
  }

  protected getFieldName() {
    return "drive_link" as const;
  }

  private async validateDriveLink(
    meetupIssue: MeetupIssue,
    shouldFix: boolean
  ): Promise<DriveFiles> {
    const driveFolder = await this.validateDriveFolder(meetupIssue, shouldFix);

    // Lint folder files
    return this.validateDriveFolderFiles(meetupIssue, driveFolder, shouldFix);
  }

  private async validateDriveFolder(meetupIssue: MeetupIssue, shouldFix: boolean) {
    const eventDate = meetupIssue.parsedBody.event_date;
    const hoster = meetupIssue.parsedBody.hoster?.[0];

    if (!eventDate) {
      throw new Error("Cannot auto-create folder - Event Date is required");
    }

    if (!hoster) {
      throw new Error("Cannot auto-create folder - Hoster is required");
    }
    const expectedFolderName = this.generateFolderName(eventDate, hoster);

    // Check if folder exists
    let driveFolder = await this.folderService.getFolder(meetupIssue.number);

    if (!driveFolder) {
      if (!shouldFix) {
        throw new Error(
          "Folder does not exist on Google Drive for meetup issue #" + meetupIssue.number
        );
      }
      driveFolder = await this.folderService.createFolder(meetupIssue.number, expectedFolderName);

      meetupIssue.parsedBody.drive_link = driveFolder.url;
    } else {
      if (driveFolder.name !== expectedFolderName) {
        if (!shouldFix) {
          throw new Error(
            `Folder name mismatch. Expected: "${expectedFolderName}", Found: "${driveFolder.name}"`
          );
        }

        driveFolder = await this.folderService.updateFolderName(driveFolder.id, expectedFolderName);
      }
    }
    return driveFolder;
  }

  /**
   * Generate folder name based on event data
   * Format: YYYY-MM-DD - MONTH - Hosting Name
   * @param eventDate - Event date (YYYY-MM-DD format)
   * @param hostingName - Hosting company/location name
   * @returns Generated folder name
   */
  private generateFolderName(eventDate: string, hostingName: string): string {
    if (!eventDate || !eventDate.trim()) {
      throw new Error("Event date is required");
    }
    if (!hostingName || !hostingName.trim()) {
      throw new Error("Hosting name is required");
    }

    const date = eventDate.trim();
    const month = this.getMonthName(date);
    const cleanHostingName = hostingName.trim();

    return `${date} - ${month} - ${cleanHostingName}`;
  }

  private getMonthName(dateString: string): string {
    const date = new Date(dateString + "T00:00:00");
    return new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
  }

  private async validateDriveFolderFiles(
    meetupIssue: MeetupIssue,
    driveFolder: GoogleDriveFolderResult,
    shouldFix: boolean
  ): Promise<DriveFiles> {
    const eventDate = meetupIssue.parsedBody.event_date;
    if (!eventDate) {
      throw new Error("Cannot auto-create folder - Event Date is required");
    }

    const expectedTemplateFiles: FileTemplateResult[] =
      await this.templateService.getTemplateFiles();
    if (!expectedTemplateFiles || expectedTemplateFiles.length === 0) {
      throw new Error("No template files found for Google Drive folder linting.");
    }

    const driveFiles: DriveFiles = {};

    for (const templateFile of expectedTemplateFiles) {
      const expectedFileName = this.replaceFilenamePlaceholders(templateFile.name!, eventDate);

      const existingFile = await this.templateService.findByTemplateId(
        driveFolder.id,
        templateFile
      );

      if (existingFile) {
        let currentFile = existingFile;

        if (currentFile.templateKind !== templateFile.templateKind) {
          if (!shouldFix) {
            throw new Error(
              `Template kind mismatch for template ID ${templateFile.id}. Expected: "${templateFile.templateKind}", Found: "${currentFile.templateKind ?? "none"}"`
            );
          }

          currentFile = await this.templateService.updateTemplateKind(currentFile, templateFile);
        }

        if (currentFile.name !== expectedFileName) {
          if (!shouldFix) {
            throw new Error(
              `File name mismatch for template ID ${templateFile.id}. Expected: "${expectedFileName}", Found: "${currentFile.name}"`
            );
          }

          currentFile = await this.templateService.updateName(currentFile, expectedFileName);
        }

        if (currentFile.url) {
          driveFiles[this.getDriveFileKey(templateFile.templateKind)] = currentFile.url;
        }

        continue; // File exists and is correctly named
      }

      if (!shouldFix) {
        throw new Error(
          `Missing file for template ID ${templateFile.id} in folder "${driveFolder.name}"`
        );
      }

      const copiedFile = await this.templateService.copyTemplateFile(
        templateFile,
        driveFolder.id,
        expectedFileName
      );

      if (copiedFile.url) {
        driveFiles[this.getDriveFileKey(templateFile.templateKind)] = copiedFile.url;
      }
    }

    return driveFiles;
  }

  /**
   * Replace placeholders in filename
   * @param fileName - Original filename
   * @param eventDate - Event date (YYYY-MM-DD format)
   * @returns Filename with replaced placeholders
   */
  private replaceFilenamePlaceholders(fileName: string, eventDate: string): string {
    if (!fileName) {
      throw new Error("File name is undefined.");
    }
    return fileName.replace(/\[EVENT_DATE:YYYY-MM-DD\]/g, eventDate);
  }

  private getDriveFileKey(templateKind: string): string {
    return `${templateKind}-link`;
  }
}
