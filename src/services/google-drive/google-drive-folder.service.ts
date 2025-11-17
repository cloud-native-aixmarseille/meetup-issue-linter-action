import { inject, injectable } from "inversify";
import { LoggerService } from "../logger.service";
import { InputService } from "../input.service";
import { GoogleDriveClientService, GoogleDriveFile } from "./google-drive-client.service";

export type GoogleDriveFolderResult = {
  id: string;
  url: string;
};

/**
 * Business logic for folder operations
 */
@injectable()
export class GoogleDriveFolderService {
  private readonly parentFolderId: string;

  constructor(
    @inject(LoggerService) private readonly logger: LoggerService,
    @inject(GoogleDriveClientService) private readonly driveClientService: GoogleDriveClientService,
    @inject(InputService) inputService: InputService
  ) {
    this.parentFolderId = inputService.getGoogleParentFolderId();
  }

  /**
   * Get or create a Google Drive folder (idempotent operation)
   * Searches by issue number stored in folder metadata
   * @param folderName - Name of the folder
   * @param parentFolderId - ID of the parent folder
   * @param issueNumber - GitHub issue number
   * @returns Folder metadata with isNewlyCreated flag
   */
  async getOrCreate(folderName: string, issueNumber: number): Promise<GoogleDriveFolderResult> {
    // Check if folder already exists by issue number
    const existingFolder = await this.findByIssueNumber(issueNumber);

    if (existingFolder) {
      this.logger.info(`Folder already exists: ${existingFolder.name}`);
      this.logger.info(`- Folder ID: ${existingFolder.id}`);
      this.logger.info(`- Link: ${existingFolder.webViewLink}`);

      // Check if name needs to be updated
      if (existingFolder.name !== folderName) {
        this.logger.info(`Updating folder name...`);

        if (!existingFolder.id) {
          throw new Error("Existing folder ID is undefined.");
        }

        const updatedFolder = await this.updateName(existingFolder.id, folderName);

        this.logger.info(`Folder name updated to: ${updatedFolder.name}`);

        return this.fileToFolderResult(updatedFolder);
      }

      return this.fileToFolderResult(existingFolder);
    }

    // Create new folder with issue metadata
    const newFolder = await this.create(folderName, issueNumber);
    this.logger.info(`Created folder: ${newFolder.name}`);
    this.logger.info(`- Folder ID: ${newFolder.id}`);
    this.logger.info(`- Link: ${newFolder.webViewLink}`);
    return this.fileToFolderResult(newFolder);
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
    };
  }

  /**
   * Search for an existing folder by issue number using custom properties
   * @param issueNumber - GitHub issue number
   * @param parentFolderId - ID of the parent folder
   * @returns Existing folder metadata or null if not found
   */
  private async findByIssueNumber(issueNumber: number): Promise<GoogleDriveFile | null> {
    try {
      const query = `'${this.parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='issue_number' and value='${issueNumber}' }`;

      const response = await this.driveClientService.getClient().files.list({
        q: query,
        fields: "files(id, name, webViewLink, appProperties)",
        pageSize: 1,
      });

      const files = response.data.files || [];
      return files.length > 0 ? files[0] : null;
    } catch (err) {
      throw new Error(
        `Failed to search for existing folder by issue number: ${(err as Error).message}`
      );
    }
  }

  /**
   * Create a folder in Google Drive with issue metadata
   * @param folderName - Name of the folder to create
   * @param parentFolderId - ID of the parent folder
   * @param issueNumber - GitHub issue number to store as metadata
   * @returns Created folder metadata
   */
  private async create(folderName: string, issueNumber: number): Promise<GoogleDriveFile> {
    try {
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

      return response.data;
    } catch (err) {
      throw new Error(`Failed to create folder: ${(err as Error).message}`);
    }
  }

  /**
   * Update folder name
   * @param folderId - ID of the folder to update
   * @param newName - New name for the folder
   * @returns Updated folder metadata
   */
  private async updateName(folderId: string, newName: string): Promise<GoogleDriveFile> {
    try {
      const response = await this.driveClientService.getClient().files.update({
        fileId: folderId,
        requestBody: {
          name: newName,
        },
        fields: "id, name, webViewLink, appProperties",
      });

      return response.data;
    } catch (err) {
      throw new Error(`Failed to update folder name: ${(err as Error).message}`, { cause: err });
    }
  }
}
