import { injectable, inject } from "inversify";
import { GoogleDriveFolderService, GoogleDriveFolderResult } from "./google-drive-folder.service";
import { GoogleDriveTemplateService } from "./google-drive-template.service";
import { LoggerService } from "../logger.service";

/**
 * Service to orchestrate Google Drive folder creation and template synchronization
 */
@injectable()
export class GoogleDriveService {
  constructor(
    @inject(LoggerService) private readonly logger: LoggerService,
    @inject(GoogleDriveFolderService) private readonly folderService: GoogleDriveFolderService,
    @inject(GoogleDriveTemplateService) private readonly templateService: GoogleDriveTemplateService
  ) {}

  /**
   * Create or get Google Drive folder for a meetup and populate with templates
   * @param issueNumber - GitHub issue number
   * @param eventDate - Event date in YYYY-MM-DD format
   * @param hostingName - Name of the hosting company/location
   * @returns Folder information including URL
   */
  async createMeetupFolder(
    issueNumber: number,
    eventDate: string,
    hostingName: string
  ): Promise<GoogleDriveFolderResult> {
    this.logger.info("Starting Google Drive folder creation...");
    this.logger.info(`   Issue Number: #${issueNumber}`);

    // Generate folder name
    const folderName = this.generateFolderName(eventDate, hostingName);

    // Get or create the meetup folder (idempotent by issue number)
    const folder = await this.folderService.getOrCreate(folderName, issueNumber);

    // Synchronize templates (idempotent - will check existing files)
    await this.templateService.synchronizeTemplates(folder.id, eventDate);

    this.logger.info("Google Drive folder creation completed successfully!");

    return folder;
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
}
