import { jest } from "@jest/globals";
import { mock, MockProxy } from "jest-mock-extended";
import { GoogleDriveClient, GoogleDriveClientService } from "./google-drive-client.service";
import { FileTemplateResult, GoogleDriveTemplateService } from "./google-drive-template.service";
import { InputService } from "../input.service";
import { LoggerService } from "../logger.service";

describe("GoogleDriveTemplateService", () => {
  let loggerService: MockProxy<LoggerService>;
  let driveClientService: MockProxy<GoogleDriveClientService>;
  let inputService: MockProxy<InputService>;
  let templateService: GoogleDriveTemplateService;
  let copyMock: jest.Mock;
  let listMock: jest.Mock;
  let updateMock: jest.Mock;

  beforeEach(() => {
    loggerService = mock<LoggerService>();
    driveClientService = mock<GoogleDriveClientService>();
    inputService = mock<InputService>();

    inputService.getGoogleTemplateFolderId.mockReturnValue("template-folder-id");

    copyMock = jest.fn().mockResolvedValue({
      data: {
        id: "copied-id",
        name: "Agenda 2024-12-15.md",
        appProperties: {
          template_file_id: "tpl-1",
          template_kind: "announcement",
        },
        webViewLink: "https://drive.google.com/file/d/copied-id",
      },
    });

    listMock = jest.fn();
    updateMock = jest.fn();

    driveClientService.getClient.mockReturnValue({
      files: {
        copy: copyMock,
        list: listMock,
        update: updateMock,
      },
    } as unknown as GoogleDriveClient);

    templateService = new GoogleDriveTemplateService(
      loggerService,
      driveClientService,
      inputService
    );
  });

  it("copies template_kind app property when duplicating a template", async () => {
    const templateFile: FileTemplateResult = {
      id: "tpl-1",
      name: "Agenda [EVENT_DATE:YYYY-MM-DD].md",
      templateKind: "announcement",
    };

    const result = await templateService.copyTemplateFile(
      templateFile,
      "destination-folder-id",
      "Agenda 2024-12-15.md"
    );

    expect(copyMock).toHaveBeenCalledWith({
      fileId: "tpl-1",
      requestBody: {
        name: "Agenda 2024-12-15.md",
        parents: ["destination-folder-id"],
        appProperties: {
          template_file_id: "tpl-1",
          template_kind: "announcement",
        },
      },
      fields: "id, name, webViewLink, appProperties",
    });

    expect(result).toEqual({
      id: "copied-id",
      name: "Agenda 2024-12-15.md",
      templateKind: "announcement",
      url: "https://drive.google.com/file/d/copied-id",
    });
  });

  it("retrieves template files across multiple pages", async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: "tpl-1",
              name: "Agenda.md",
              webViewLink: "https://drive.google.com/file/d/tpl-1",
              appProperties: { template_kind: "agenda" },
            },
          ],
          nextPageToken: "next-token",
        },
      })
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: "tpl-2",
              name: "Slides.md",
              webViewLink: "https://drive.google.com/file/d/tpl-2",
              appProperties: { template_kind: "slides" },
            },
          ],
        },
      });

    const result = await templateService.getTemplateFiles();

    expect(listMock).toHaveBeenNthCalledWith(1, {
      q: "'template-folder-id' in parents and trashed=false",
      fields: "nextPageToken, files(id, name, webViewLink, appProperties)",
      pageSize: 100,
      pageToken: undefined,
    });
    expect(listMock).toHaveBeenNthCalledWith(2, {
      q: "'template-folder-id' in parents and trashed=false",
      fields: "nextPageToken, files(id, name, webViewLink, appProperties)",
      pageSize: 100,
      pageToken: "next-token",
    });

    expect(result).toEqual([
      {
        id: "tpl-1",
        name: "Agenda.md",
        templateKind: "agenda",
        url: "https://drive.google.com/file/d/tpl-1",
      },
      {
        id: "tpl-2",
        name: "Slides.md",
        templateKind: "slides",
        url: "https://drive.google.com/file/d/tpl-2",
      },
    ]);
  });

  it("throws when listing templates fails", async () => {
    listMock.mockRejectedValue(new Error("boom"));

    await expect(templateService.getTemplateFiles()).rejects.toThrow(
      "Failed to retrieve template files: boom"
    );
  });

  it("finds existing file by template id", async () => {
    const templateFile: FileTemplateResult = {
      id: "tpl-1",
      name: "Agenda.md",
      templateKind: "agenda",
    };

    listMock.mockResolvedValue({
      data: {
        files: [
          {
            id: "file-1",
            name: "Agenda 2024.md",
            webViewLink: "https://drive.google.com/file/d/file-1",
            appProperties: { template_kind: "agenda", template_file_id: "tpl-1" },
          },
        ],
      },
    });

    const result = await templateService.findByTemplateId("dest-folder", templateFile);

    expect(listMock).toHaveBeenCalledWith({
      q: "'dest-folder' in parents and trashed=false and appProperties has { key='template_file_id' and value='tpl-1' }",
      fields: "files(id, name, webViewLink, appProperties)",
      pageSize: 1,
    });
    expect(result).toEqual({
      id: "file-1",
      name: "Agenda 2024.md",
      templateKind: "agenda",
      url: "https://drive.google.com/file/d/file-1",
    });
  });

  it("throws when template id is missing for search", async () => {
    const invalidTemplateFile = {
      id: undefined,
      name: "Agenda.md",
      templateKind: "agenda",
    } as unknown as FileTemplateResult;

    await expect(
      templateService.findByTemplateId("dest-folder", invalidTemplateFile)
    ).rejects.toThrow("Template file ID is undefined.");
  });

  it("updates file name and returns mapped result", async () => {
    updateMock.mockResolvedValue({
      data: {
        id: "file-1",
        name: "New Name.md",
        webViewLink: "https://drive.google.com/file/d/file-1",
        appProperties: { template_kind: "agenda" },
      },
    });

    const result = await templateService.updateName(
      { id: "file-1", name: "Old Name.md", templateKind: "agenda", url: "" },
      "New Name.md"
    );

    expect(updateMock).toHaveBeenCalledWith({
      fileId: "file-1",
      requestBody: { name: "New Name.md" },
      fields: "id, name, webViewLink, appProperties",
    });
    expect(result).toEqual({
      id: "file-1",
      name: "New Name.md",
      templateKind: "agenda",
      url: "https://drive.google.com/file/d/file-1",
    });
  });

  it("throws when updateName fails", async () => {
    updateMock.mockRejectedValue(new Error("boom"));

    await expect(
      templateService.updateName({ id: "file-1", name: "Old.md", templateKind: "agenda" }, "New.md")
    ).rejects.toThrow("Failed to update file name: boom");
  });

  it("updates template kind app properties", async () => {
    updateMock.mockResolvedValue({
      data: {
        id: "file-1",
        name: "Agenda.md",
        webViewLink: "https://drive.google.com/file/d/file-1",
        appProperties: { template_kind: "announcement" },
      },
    });

    const file = { id: "file-1", name: "Agenda.md", templateKind: "agenda", url: "" };
    const templateFile: FileTemplateResult = {
      id: "tpl-1",
      name: "Agenda Template",
      templateKind: "announcement",
    };

    const result = await templateService.updateTemplateKind(file, templateFile);

    expect(updateMock).toHaveBeenCalledWith({
      fileId: "file-1",
      requestBody: {
        appProperties: {
          template_file_id: "tpl-1",
          template_kind: "announcement",
        },
      },
      fields: "id, name, webViewLink, appProperties",
    });
    expect(result).toEqual({
      id: "file-1",
      name: "Agenda.md",
      templateKind: "announcement",
      url: "https://drive.google.com/file/d/file-1",
    });
  });
});
