import { inject, injectable } from "inversify";
import { LoggerService } from "../logger.service.js";
import { InputService } from "../input.service.js";
import { GoogleDriveClientService, GoogleDriveFile } from "./google-drive-client.service.js";

const TEMPLATE_FILE_ID_APP_PROPERTY = "template_file_id";
const TEMPLATE_KIND_APP_PROPERTY = "template_kind";

export type FileResult = {
  id: string;
  name: string;
  templateKind: string | null;
  url?: string;
};

export type FileTemplateResult = FileResult & {
  templateKind: string;
};

/**
 * Business logic for template operations
 */
@injectable()
export class GoogleDriveTemplateService {
  private readonly templateFolderId: string;
  constructor(
    @inject(LoggerService) private readonly loggerService: LoggerService,
    @inject(GoogleDriveClientService) private readonly driveClientService: GoogleDriveClientService,
    @inject(InputService) inputService: InputService
  ) {
    this.templateFolderId = inputService.getGoogleTemplateFolderId();
  }

  /**
   * Retrieve all template files from the template folder
   * @returns Array of template file metadata
   */
  async getTemplateFiles(): Promise<FileTemplateResult[]> {
    try {
      const files: FileTemplateResult[] = [];
      let pageToken: string | undefined = undefined;
      let response;
      do {
        response = await this.driveClientService.getClient().files.list({
          q: `'${this.templateFolderId}' in parents and trashed=false`,
          fields: "nextPageToken, files(id, name, webViewLink, appProperties)",
          pageSize: 100,
          pageToken: pageToken,
        });

        if (response.data.files) {
          files.push(
            ...response.data.files.map((file: GoogleDriveFile) =>
              this.mapToTemplateFileResult(file)
            )
          );
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return files;
    } catch (err) {
      throw new Error(`Failed to retrieve template files: ${(err as Error).message}`);
    }
  }

  /**
   * Find existing file in destination folder by template file ID
   * @param destinationFolderId - ID of the destination folder
   * @param templateFile - Template file metadata
   * @returns Found file metadata or null if not found
   */
  async findByTemplateId(
    destinationFolderId: string,
    templateFile: FileTemplateResult
  ): Promise<FileResult | null> {
    try {
      if (!templateFile.id) {
        throw new Error("Template file ID is undefined.");
      }
      const query = `'${destinationFolderId}' in parents and trashed=false and appProperties has { key='${TEMPLATE_FILE_ID_APP_PROPERTY}' and value='${templateFile.id}' }`;

      const response = await this.driveClientService.getClient().files.list({
        q: query,
        fields: "files(id, name, webViewLink, appProperties)",
        pageSize: 1,
      });

      const files = response.data.files || [];
      return files.length > 0 ? this.mapToFileResult(files[0]) : null;
    } catch (err) {
      throw new Error(
        `Failed to search for existing file by template ID: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  /**
   * Update file name
   * @param file - File metadata
   * @param newName - New name for the file
   * @returns Updated file metadata
   */
  async updateName(file: FileResult, newName: string): Promise<FileResult> {
    try {
      const response = await this.driveClientService.getClient().files.update({
        fileId: file.id,
        requestBody: {
          name: newName,
        },
        fields: "id, name, webViewLink, appProperties",
      });

      return this.mapToFileResult(response.data);
    } catch (err) {
      throw new Error(`Failed to update file name: ${(err as Error).message}`);
    }
  }

  async updateTemplateKind(
    file: FileResult,
    templateFile: FileTemplateResult
  ): Promise<FileResult> {
    try {
      const response = await this.driveClientService.getClient().files.update({
        fileId: file.id,
        requestBody: {
          appProperties: {
            [TEMPLATE_FILE_ID_APP_PROPERTY]: templateFile.id,
            [TEMPLATE_KIND_APP_PROPERTY]: templateFile.templateKind,
          },
        },
        fields: "id, name, webViewLink, appProperties",
      });

      return this.mapToFileResult(response.data);
    } catch (err) {
      throw new Error(
        `Failed to update template kind for file '${file.name}': ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  /**
   * Copy a single template file to the destination folder
   * @param templateFile - Template file metadata
   * @param destinationFolderId - ID of the destination folder
   * @param fileName - Name for the copied file
   * @returns Copied file metadata
   */
  async copyTemplateFile(
    templateFile: FileTemplateResult,
    destinationFolderId: string,
    fileName: string
  ): Promise<FileResult> {
    try {
      const appProperties: Record<string, string> = {
        [TEMPLATE_FILE_ID_APP_PROPERTY]: templateFile.id,
      };

      appProperties[TEMPLATE_KIND_APP_PROPERTY] = templateFile.templateKind;

      const response = await this.driveClientService.getClient().files.copy({
        fileId: templateFile.id,
        requestBody: {
          name: fileName,
          parents: [destinationFolderId],
          appProperties,
        },
        fields: "id, name, webViewLink, appProperties",
      });

      return this.mapToFileResult(response.data);
    } catch (err) {
      throw new Error(`Failed to copy template file '${fileName}': ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  private mapToTemplateFileResult(file: GoogleDriveFile): FileTemplateResult {
    if (!file.id) {
      throw new Error("File ID is undefined.");
    }

    const templateKind = file.appProperties?.[TEMPLATE_KIND_APP_PROPERTY];

    if (!templateKind) {
      throw new Error(`Template kind is missing for file ${file.id}`);
    }

    return {
      id: file.id,
      name: file.name || "",
      templateKind,
      ...(file.webViewLink ? { url: file.webViewLink } : {}),
    };
  }

  private mapToFileResult(file: GoogleDriveFile): FileResult {
    if (!file.id) {
      throw new Error("File ID is undefined.");
    }

    return {
      id: file.id,
      name: file.name || "",
      templateKind: file.appProperties?.[TEMPLATE_KIND_APP_PROPERTY] ?? null,
      ...(file.webViewLink ? { url: file.webViewLink } : {}),
    };
  }
}
