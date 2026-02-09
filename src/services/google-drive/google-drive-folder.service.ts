import { inject, injectable } from "inversify";
import { LoggerService } from "../logger.service.js";
import { InputService } from "../input.service.js";
import { GoogleDriveClientService, GoogleDriveFile } from "./google-drive-client.service.js";

export type GoogleDriveFolderResult = {
  id: string;
  url: string;
  name: string;
};

/**
 * Business logic for folder operations
 */
@injectable()
export class GoogleDriveFolderService {
  private readonly parentFolderId: string;

  constructor(
    @inject(LoggerService) private readonly loggerService: LoggerService,
    @inject(GoogleDriveClientService) private readonly driveClientService: GoogleDriveClientService,
    @inject(InputService) inputService: InputService
  ) {
    this.parentFolderId = inputService.getGoogleParentFolderId();
  }

  async getFolder(issueNumber: number): Promise<GoogleDriveFolderResult | null> {
    const query = `'${this.parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='issue_number' and value='${issueNumber}' }`;

    const response = await this.driveClientService.getClient().files.list({
      q: query,
      fields: "files(id, name, webViewLink, appProperties)",
      pageSize: 1,
    });

    const files = response.data.files || [];
    return files.length > 0 ? this.fileToFolderResult(files[0]) : null;
  }

  /**
   * Get or create a Google Drive folder (idempotent operation)
   * Searches by issue number stored in folder metadata
   * @param folderName - Name of the folder
   * @param parentFolderId - ID of the parent folder
   * @param issueNumber - GitHub issue number
   * @returns Folder metadata with isNewlyCreated flag
   */
  async createFolder(issueNumber: number, folderName: string): Promise<GoogleDriveFolderResult> {
    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [this.parentFolderId],
      appProperties: {
        issue_number: String(issueNumber),
      },
    };

    const response = await this.driveClientService.getClient().files.create({
      requestBody: fileMetadata,
      fields: "id, name, webViewLink, appProperties",
    });

    return this.fileToFolderResult(response.data);
  }

  /**
   * Update folder name
   * @param folderId - ID of the folder to update
   * @param newName - New name for the folder
   * @returns Updated folder metadata
   */
  async updateFolderName(folderId: string, newName: string): Promise<GoogleDriveFolderResult> {
    try {
      const response = await this.driveClientService.getClient().files.update({
        fileId: folderId,
        requestBody: {
          name: newName,
        },
        fields: "id, name, webViewLink, appProperties",
      });

      return this.fileToFolderResult(response.data);
    } catch (err) {
      throw new Error(`Failed to update folder name: ${(err as Error).message}`, { cause: err });
    }
  }

  private fileToFolderResult(file: GoogleDriveFile): GoogleDriveFolderResult {
    if (!file.id) {
      throw new Error("File ID is undefined.");
    }

    if (!file.webViewLink) {
      throw new Error("File webViewLink is undefined.");
    }

    return {
      id: file.id,
      url: file.webViewLink,
      name: file.name || "",
    };
  }
}
