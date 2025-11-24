import { inject, injectable } from "inversify";
import { LoggerService } from "../logger.service";
import { InputService } from "../input.service";
import { GoogleDriveClientService, GoogleDriveFile } from "./google-drive-client.service";

export type FileResult = {
  id: string;
  name: string;
  webViewLink?: string;
  appProperties?: Record<string, string>;
  isNewlyCreated: boolean;
};

export type SyncResult = {
  total: number;
  newFiles: number;
  existingFiles: number;
};

/**
 * Business logic for template operations
 */
@injectable()
export class GoogleDriveTemplateService {
  private readonly templateFolderId: string;
  constructor(
    @inject(LoggerService) private readonly logger: LoggerService,
    @inject(GoogleDriveClientService) private readonly driveClientService: GoogleDriveClientService,
    @inject(InputService) inputService: InputService
  ) {
    this.templateFolderId = inputService.getGoogleTemplateFolderId();
  }

  /**
   * Synchronize all template files to destination folder (idempotent)
   * @param templateFolderId - ID of the template folder
   * @param destinationFolderId - ID of the destination folder
   * @param eventDate - Event date for placeholder replacement
   * @returns Statistics about copied/existing files
   */
  async synchronizeTemplates(destinationFolderId: string, eventDate: string): Promise<void> {
    this.logger.info("Ensuring all template files are present...");

    const templateFiles = await this.getTemplateFiles();

    if (templateFiles.length === 0) {
      this.logger.info("No template files found in template folder");
      return;
    }

    for (const file of templateFiles) {
      await this.copyFileIfNotExists(file, destinationFolderId, eventDate);
    }

    this.logger.info(`All ${templateFiles.length} template file(s) are present`);

    return;
  }

  private async getTemplateFiles(): Promise<GoogleDriveFile[]> {
    try {
      const files: GoogleDriveFile[] = [];
      let pageToken: string | undefined = undefined;
      let response;
      do {
        response = await this.driveClientService.getClient().files.list({
          q: `'${this.templateFolderId}' in parents and trashed=false`,
          fields: "nextPageToken, files(id, name, appProperties)",
          pageSize: 100,
          pageToken: pageToken,
        });

        if (response.data.files) {
          files.push(...response.data.files);
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return files;
    } catch (err) {
      throw new Error(`Failed to retrieve template files: ${(err as Error).message}`);
    }
  }

  /**
   * Copy a single file if it doesn't already exist, or validate/update its name
   * @param fileId - ID of the file to copy
   * @param fileName - Original file name
   * @param destinationFolderId - ID of the destination folder
   * @param eventDate - Event date for placeholder replacement
   * @returns Result with isNewlyCreated flag
   */
  private async copyFileIfNotExists(
    file: GoogleDriveFile,
    destinationFolderId: string,
    eventDate: string
  ): Promise<GoogleDriveFile> {
    // Replace placeholders in filename to get expected name
    const expectedName = this.replaceFilenamePlaceholders(file, eventDate);

    // Check if file already exists
    const existingFile = await this.findByTemplateId(destinationFolderId, file);

    if (existingFile) {
      this.logger.info(`Already exists: ${existingFile.name}`);

      // Check if name needs to be updated
      if (existingFile.name !== expectedName) {
        this.logger.info(`Updating file name...`);
        const updatedFile = await this.updateName(existingFile.id, expectedName);

        this.logger.info(`File name updated to: ${updatedFile.name}`);

        return updatedFile;
      }

      return existingFile;
    }

    // Copy the file
    const copiedFile = await this.copy(file, expectedName, destinationFolderId);

    this.logger.info(`Copied: ${copiedFile.name}`);

    return copiedFile;
  }

  /**
   * Replace placeholders in filename
   * @param fileName - Original filename
   * @param eventDate - Event date (YYYY-MM-DD format)
   * @returns Filename with replaced placeholders
   */
  private replaceFilenamePlaceholders(file: GoogleDriveFile, eventDate: string): string {
    if (!file.name) {
      throw new Error("File name is undefined.");
    }
    return file.name.replace(/\[YYYY-MM-DD\]/g, eventDate);
  }

  /**
   * Check if a file with the given template ID already exists in the destination folder
   * @param destinationFolderId - ID of the destination folder
   * @param templateFileId - ID of the template file
   * @returns Existing file metadata or null if not found
   */
  private async findByTemplateId(
    destinationFolderId: string,
    templateFile: GoogleDriveFile
  ): Promise<FileResult | null> {
    try {
      if (!templateFile.id) {
        throw new Error("Template file ID is undefined.");
      }
      const query = `'${destinationFolderId}' in parents and trashed=false and appProperties has { key='template_file_id' and value='${templateFile.id}' }`;

      const response = await this.driveClientService.getClient().files.list({
        q: query,
        fields: "files(id, name, appProperties)",
        pageSize: 1,
      });

      const files = response.data.files || [];
      return files.length > 0 ? (files[0] as FileResult) : null;
    } catch (err) {
      throw new Error(
        `Failed to search for existing file by template ID: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  /**
   * Copy a file to a destination folder with template tracking
   * @param fileId - ID of the file to copy
   * @param fileName - Name for the copied file
   * @param destinationFolderId - ID of the destination folder
   * @returns Copied file metadata
   */
  private async copy(
    file: GoogleDriveFile,
    fileName: string,
    destinationFolderId: string
  ): Promise<GoogleDriveFile> {
    try {
      if (!file.id) {
        throw new Error("File ID is undefined.");
      }

      const response = await this.driveClientService.getClient().files.copy({
        fileId: file.id,
        requestBody: {
          name: fileName,
          parents: [destinationFolderId],
          appProperties: {
            template_file_id: file.id,
          },
        },
        fields: "id, name, webViewLink, appProperties",
      });

      return response.data;
    } catch (err) {
      throw new Error(`Failed to copy file '${fileName}': ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  /**
   * Update file name
   * @param fileId - ID of the file to update
   * @param newName - New name for the file
   * @returns Updated file metadata
   */
  private async updateName(fileId: string, newName: string): Promise<GoogleDriveFile> {
    try {
      const response = await this.driveClientService.getClient().files.update({
        fileId,
        requestBody: {
          name: newName,
        },
        fields: "id, name, webViewLink, appProperties",
      });

      return response.data;
    } catch (err) {
      throw new Error(`Failed to update file name: ${(err as Error).message}`);
    }
  }
}
