import { jest } from "@jest/globals";
import { mock, MockProxy } from "jest-mock-extended";
import { GoogleDriveClient, GoogleDriveClientService } from "./google-drive-client.service";
import { GoogleDriveFolderService } from "./google-drive-folder.service";
import { InputService } from "../input.service";
import { LoggerService } from "../logger.service";

describe("GoogleDriveFolderService", () => {
  let loggerService: MockProxy<LoggerService>;
  let driveClientService: MockProxy<GoogleDriveClientService>;
  let inputService: MockProxy<InputService>;
  let folderService: GoogleDriveFolderService;
  let listMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;

  beforeEach(() => {
    loggerService = mock<LoggerService>();
    driveClientService = mock<GoogleDriveClientService>();
    inputService = mock<InputService>();

    inputService.getGoogleParentFolderId.mockReturnValue("parent-folder-id");

    listMock = jest.fn();
    createMock = jest.fn();
    updateMock = jest.fn();

    driveClientService.getClient.mockReturnValue({
      files: {
        list: listMock,
        create: createMock,
        update: updateMock,
      },
    } as unknown as GoogleDriveClient);

    folderService = new GoogleDriveFolderService(loggerService, driveClientService, inputService);
  });

  it("returns folder metadata when found", async () => {
    listMock.mockResolvedValue({
      data: {
        files: [
          {
            id: "folder-id",
            name: "Folder Name",
            webViewLink: "https://drive.google.com/drive/folders/folder-id",
            appProperties: { issue_number: "42" },
          },
        ],
      },
    });

    const result = await folderService.getFolder(42);

    expect(listMock).toHaveBeenCalledWith({
      q: "'parent-folder-id' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='issue_number' and value='42' }",
      fields: "files(id, name, webViewLink, appProperties)",
      pageSize: 1,
    });
    expect(result).toEqual({
      id: "folder-id",
      url: "https://drive.google.com/drive/folders/folder-id",
      name: "Folder Name",
    });
  });

  it("returns null when no folder matches", async () => {
    listMock.mockResolvedValue({ data: { files: [] } });

    const result = await folderService.getFolder(100);

    expect(result).toBeNull();
  });

  it("creates a folder with metadata and returns mapped result", async () => {
    createMock.mockResolvedValue({
      data: {
        id: "new-folder-id",
        name: "Expected Folder",
        webViewLink: "https://drive.google.com/drive/folders/new-folder-id",
        appProperties: { issue_number: "7" },
      },
    });

    const result = await folderService.createFolder(7, "Expected Folder");

    expect(createMock).toHaveBeenCalledWith({
      requestBody: {
        name: "Expected Folder",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["parent-folder-id"],
        appProperties: { issue_number: "7" },
      },
      fields: "id, name, webViewLink, appProperties",
    });
    expect(result).toEqual({
      id: "new-folder-id",
      url: "https://drive.google.com/drive/folders/new-folder-id",
      name: "Expected Folder",
    });
  });

  it("updates folder name and maps response", async () => {
    updateMock.mockResolvedValue({
      data: {
        id: "folder-id",
        name: "Renamed",
        webViewLink: "https://drive.google.com/drive/folders/folder-id",
      },
    });

    const result = await folderService.updateFolderName("folder-id", "Renamed");

    expect(updateMock).toHaveBeenCalledWith({
      fileId: "folder-id",
      requestBody: { name: "Renamed" },
      fields: "id, name, webViewLink, appProperties",
    });
    expect(result).toEqual({
      id: "folder-id",
      url: "https://drive.google.com/drive/folders/folder-id",
      name: "Renamed",
    });
  });

  it("throws a descriptive error when update fails", async () => {
    updateMock.mockRejectedValue(new Error("boom"));

    await expect(folderService.updateFolderName("folder-id", "Renamed")).rejects.toThrow(
      "Failed to update folder name: boom"
    );
  });
});
