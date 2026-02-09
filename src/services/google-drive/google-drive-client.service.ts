import { google, drive_v3 } from "googleapis";
import { inject, injectable } from "inversify";
import { InputService } from "../input.service.js";

export type GoogleDriveClient = drive_v3.Drive;
export type GoogleDriveFile = drive_v3.Schema$File;

/**
 * Google Drive client service
 */
@injectable()
export class GoogleDriveClientService {
  private drive: GoogleDriveClient | undefined;

  /**
   * Create a Google Drive client
   * @param credentialsJson - Service account credentials JSON string
   */
  constructor(@inject(InputService) private readonly inputService: InputService) {}

  /**
   * Get the drive instance
   * @returns Google Drive service instance
   */
  getClient(): GoogleDriveClient {
    if (!this.drive) {
      const credentials = JSON.parse(this.inputService.getGoogleCredentials());

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive"],
      });

      this.drive = google.drive({ version: "v3", auth });
    }

    return this.drive;
  }
}
