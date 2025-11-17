import { jest } from "@jest/globals";
import { mock, MockProxy } from "jest-mock-extended";
import type { CoreService } from "./services/core.service.js";
import type { GitHubService } from "./services/github.service.js";
import type { InputService } from "./services/input.service.js";
import type { GoogleDriveFolderService } from "./services/google-drive/google-drive-folder.service.js";
import type { FileTemplateResult } from "./services/google-drive/google-drive-template.service.js";
import type { GoogleDriveTemplateService } from "./services/google-drive/google-drive-template.service.js";
import type { ValidMeetupIssueOutput } from "./services/valid-meetup-issue-output.service.js";
import type { ValidMeetupIssueOutputService } from "./services/valid-meetup-issue-output.service.js";

const coreMock = {
  setFailed: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setOutput: jest.fn(),
};

await jest.unstable_mockModule("@actions/core", () => coreMock);

const core = await import("@actions/core");
const { container } = await import("./container.js");
const { InputService } = await import("./services/input.service.js");
const { CORE_SERVICE_IDENTIFIER } = await import("./services/core.service.js");
const { GitHubService } = await import("./services/github.service.js");
const { GoogleDriveFolderService } = await import(
  "./services/google-drive/google-drive-folder.service.js"
);
const { GoogleDriveTemplateService } = await import(
  "./services/google-drive/google-drive-template.service.js"
);
const { ValidMeetupIssueOutputService } = await import(
  "./services/valid-meetup-issue-output.service.js"
);
const indexRunner = await import("./index-runner.js");
const { getMeetupIssueFixture } = await import("./__fixtures__/meetup-issue.fixture.js");
const { getHostersFixture } = await import("./__fixtures__/hosters.fixture.js");
const { getSpeakersFixture } = await import("./__fixtures__/speakers.fixture.js");

describe("run", () => {
  let setFailedMock: jest.SpiedFunction<typeof core.setFailed>;
  let inputServiceMock: MockProxy<InputService>;
  let coreServiceMock: MockProxy<CoreService>;
  let githubServiceMock: MockProxy<GitHubService>;
  let googleDriveFolderServiceMock: MockProxy<GoogleDriveFolderService>;
  let googleDriveTemplateServiceMock: MockProxy<GoogleDriveTemplateService>;
  let validMeetupIssueOutputServiceMock: MockProxy<ValidMeetupIssueOutputService>;

  const hosters = getHostersFixture();
  const speakers = getSpeakersFixture();

  beforeEach(async () => {
    jest.clearAllMocks();

    setFailedMock = jest.spyOn(core, "setFailed").mockImplementation();
    inputServiceMock = mock<InputService>();
    coreServiceMock = mock<CoreService>();
    githubServiceMock = mock<GitHubService>();
    googleDriveFolderServiceMock = mock<GoogleDriveFolderService>();
    googleDriveTemplateServiceMock = mock<GoogleDriveTemplateService>();
    validMeetupIssueOutputServiceMock = mock<ValidMeetupIssueOutputService>();

    container.snapshot();

    await container.unbind(InputService);
    container.bind(InputService).toConstantValue(inputServiceMock);
    await container.unbind(CORE_SERVICE_IDENTIFIER);
    container.bind<CoreService>(CORE_SERVICE_IDENTIFIER).toConstantValue(coreServiceMock);
    await container.unbind(GitHubService);
    container.bind<GitHubService>(GitHubService).toConstantValue(githubServiceMock);
    await container.unbind(GoogleDriveFolderService);
    container
      .bind<GoogleDriveFolderService>(GoogleDriveFolderService)
      .toConstantValue(googleDriveFolderServiceMock);
    await container.unbind(GoogleDriveTemplateService);
    container
      .bind<GoogleDriveTemplateService>(GoogleDriveTemplateService)
      .toConstantValue(googleDriveTemplateServiceMock);
    await container.unbind(ValidMeetupIssueOutputService);
    container
      .bind<ValidMeetupIssueOutputService>(ValidMeetupIssueOutputService)
      .toConstantValue(validMeetupIssueOutputServiceMock);

    inputServiceMock.getIssueNumber.mockReturnValue(1);
    inputServiceMock.getShouldFix.mockReturnValue(true);
    inputServiceMock.getFailOnError.mockReturnValue(false);
    inputServiceMock.getHosters.mockReturnValue(hosters);

    inputServiceMock.getSpeakers.mockReturnValue(speakers);
  });

  afterEach(() => {
    container.restore();
  });

  const getExpectedFolderName = (eventDate: string, hoster: string) => {
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
      new Date(`${eventDate}T00:00:00`)
    );

    return `${eventDate} - ${month} - ${hoster}`;
  };

  const mockTemplateHappyPath = (eventDate: string, folderId: string, driveLink: string) => {
    const templateFiles: FileTemplateResult[] = [
      {
        id: "tpl-announcement",
        name: "Announcement [EVENT_DATE:YYYY-MM-DD].md",
        templateKind: "announcement",
      },
      {
        id: "tpl-presentation",
        name: "Presentation [EVENT_DATE:YYYY-MM-DD].md",
        templateKind: "presentation",
      },
    ];

    const expectedFileNames: Record<string, string> = {
      announcement: `Announcement ${eventDate}.md`,
      presentation: `Presentation ${eventDate}.md`,
    };

    googleDriveTemplateServiceMock.getTemplateFiles.mockResolvedValue(templateFiles);
    googleDriveTemplateServiceMock.findByTemplateId.mockImplementation(async (folder, template) => {
      if (folder !== folderId) {
        throw new Error(`Unexpected folder id ${folder}`);
      }

      return {
        id: template.id,
        name: expectedFileNames[template.templateKind],
        templateKind: template.templateKind,
        url: `${driveLink}/${template.templateKind}`,
      };
    });

    return expectedFileNames;
  };

  it("should lint given valid issue and succeed", async () => {
    // Arrange
    const meetupIssue = getMeetupIssueFixture();
    inputServiceMock.getIssueParsedBody.mockReturnValue(meetupIssue.parsedBody);

    const expectedOutput: ValidMeetupIssueOutput = {
      number: meetupIssue.number,
      title: meetupIssue.title,
      "parsed-body": meetupIssue.parsedBody,
      labels: meetupIssue.labels,
      hoster: hosters[0],
      speakers,
      "drive-files": {
        "announcement-link": `${meetupIssue.parsedBody.drive_link}/announcement`,
        "presentation-link": `${meetupIssue.parsedBody.drive_link}/presentation`,
      },
    };
    validMeetupIssueOutputServiceMock.build.mockResolvedValue(expectedOutput);

    googleDriveFolderServiceMock.getFolder.mockResolvedValue({
      id: "folder-id",
      url: meetupIssue.parsedBody.drive_link!,
      name: getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      ),
    });
    mockTemplateHappyPath(
      meetupIssue.parsedBody.event_date!,
      "folder-id",
      meetupIssue.parsedBody.drive_link!
    );

    githubServiceMock.getIssue.mockResolvedValue({
      number: meetupIssue.number,
      title: meetupIssue.title,
      labels: meetupIssue.labels,
      body: meetupIssue.body,
    });

    // Act
    await indexRunner.run();

    // Assert
    expect(coreServiceMock.debug).toHaveBeenCalledWith("Issue number: 1");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Start linting issue 1...");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Issue linted successfully.");
    expect(coreServiceMock.setOutput).toHaveBeenCalledWith(
      "valid-meetup-issue",
      JSON.stringify(expectedOutput)
    );
    expect(githubServiceMock.updateIssue).not.toHaveBeenCalled();

    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it("should lint given issue, fix it and succeed", async () => {
    // Arrange
    const meetupIssue = getMeetupIssueFixture();
    const parsedBodyWithFix = {
      ...meetupIssue.parsedBody,
      hoster: [hosters[1].name], // This will trigger a fix
      cncf_link:
        "https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-test-meetup-event/",
    };

    const expectedOutput: ValidMeetupIssueOutput = {
      number: meetupIssue.number,
      title: "[Meetup] - 2021-12-31 - December - Meetup Event",
      "parsed-body": {
        ...parsedBodyWithFix,
        hoster: [`[${hosters[1].name}](${hosters[1].url})`],
      },
      labels: meetupIssue.labels,
      hoster: hosters[1],
      speakers,
      "drive-files": {
        "announcement-link": `${meetupIssue.parsedBody.drive_link}/announcement`,
        "presentation-link": `${meetupIssue.parsedBody.drive_link}/presentation`,
      },
    };
    validMeetupIssueOutputServiceMock.build.mockResolvedValue(expectedOutput);

    inputServiceMock.getIssueParsedBody.mockReturnValue(parsedBodyWithFix);

    githubServiceMock.getIssue.mockResolvedValue({
      number: meetupIssue.number,
      title: "", // Title will be updated
      labels: meetupIssue.labels,
      body: meetupIssue.body,
    });

    googleDriveFolderServiceMock.getFolder.mockResolvedValue({
      id: "folder-id",
      url: meetupIssue.parsedBody.drive_link!,
      name: getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        parsedBodyWithFix.hoster![0]!
      ),
    });
    googleDriveFolderServiceMock.updateFolderName.mockResolvedValue({
      id: "folder-id",
      url: meetupIssue.parsedBody.drive_link!,
      name: getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        `[${hosters[1].name}](${hosters[1].url})`
      ),
    });
    mockTemplateHappyPath(
      meetupIssue.parsedBody.event_date!,
      "folder-id",
      meetupIssue.parsedBody.drive_link!
    );

    // Act
    await indexRunner.run();

    // Assert
    expect(coreServiceMock.debug).toHaveBeenCalledWith("Issue number: 1");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Start linting issue 1...");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Issue linted successfully.");
    expect(coreServiceMock.setOutput).toHaveBeenCalledWith(
      "valid-meetup-issue",
      JSON.stringify(expectedOutput)
    );

    expect(githubServiceMock.updateIssue).toHaveBeenCalledWith(1, {
      title: "[Meetup] - 2021-12-31 - December - Meetup Event",
      body: expect.stringContaining(`### Hoster\n\n[${hosters[1].name}](${hosters[1].url})`),
    });

    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it("should handle lint errors", async () => {
    // Arrange
    const meetupIssue = getMeetupIssueFixture({
      parsedBody: {
        hoster: [], // This will trigger a lint error
        agenda: "", // This will trigger a lint error
      },
    });

    inputServiceMock.getIssueParsedBody.mockReturnValue(meetupIssue.parsedBody);

    githubServiceMock.getIssue.mockResolvedValue({
      number: meetupIssue.number,
      title: meetupIssue.title,
      labels: meetupIssue.labels,
      body: meetupIssue.body,
    });

    googleDriveFolderServiceMock.getFolder.mockResolvedValue({
      id: "folder-id",
      url: meetupIssue.parsedBody.drive_link!,
      name: getExpectedFolderName(
        meetupIssue.parsedBody.event_date!,
        meetupIssue.parsedBody.hoster![0]!
      ),
    });
    mockTemplateHappyPath(
      meetupIssue.parsedBody.event_date!,
      "folder-id",
      meetupIssue.parsedBody.drive_link!
    );

    // Act
    await indexRunner.run();

    // Assert
    expect(coreServiceMock.debug).toHaveBeenCalledWith("Issue number: 1");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Start linting issue 1...");

    expect(coreServiceMock.setOutput).toHaveBeenCalledWith(
      "lint-issues",
      "Hoster: Must not be empty\nAgenda: Must not be empty"
    );
    expect(coreServiceMock.setOutput).toHaveBeenCalledTimes(1);
    expect(validMeetupIssueOutputServiceMock.build).not.toHaveBeenCalled();

    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it("should handle unexpected error and call setFailed", async () => {
    // Arrange
    const meetupIssue = getMeetupIssueFixture();
    inputServiceMock.getIssueParsedBody.mockReturnValue(meetupIssue.parsedBody);

    githubServiceMock.getIssue.mockResolvedValue({
      number: meetupIssue.number,
      title: meetupIssue.title,
      labels: meetupIssue.labels,
      body: meetupIssue.body,
    });

    const error = new Error("Test error");
    githubServiceMock.getIssue.mockRejectedValue(error);

    // Act
    await indexRunner.run();

    // Assert
    expect(setFailedMock).toHaveBeenCalledWith("Error: Test error");
  });

  it("should handle unknown error and call setFailed", async () => {
    // Arrange
    const meetupIssue = getMeetupIssueFixture();
    inputServiceMock.getIssueParsedBody.mockReturnValue(meetupIssue.parsedBody);

    githubServiceMock.getIssue.mockResolvedValue({
      number: meetupIssue.number,
      title: meetupIssue.title,
      labels: meetupIssue.labels,
      body: meetupIssue.body,
    });

    const error = "Test error";
    githubServiceMock.getIssue.mockRejectedValue(error);

    // Act
    await indexRunner.run();

    // Assert
    expect(setFailedMock).toHaveBeenCalledWith('"Test error"');
  });
});
