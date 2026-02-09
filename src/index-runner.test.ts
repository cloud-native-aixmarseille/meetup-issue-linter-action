import { jest } from "@jest/globals";
import { mock, MockProxy } from "jest-mock-extended";
import type { InputService } from "./services/input.service.js";
import type { CoreService } from "./services/core.service.js";
import type { GitHubService } from "./services/github.service.js";

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
const { InputService } = await import("./services/input.service.js");
const indexRunner = await import("./index-runner.js");
const { container } = await import("./container.js");
const { getMeetupIssueFixture } = await import("./__fixtures__/meetup-issue.fixture.js");
const { CORE_SERVICE_IDENTIFIER } = await import("./services/core.service.js");
const { GitHubService } = await import("./services/github.service.js");
const { getHostersFixture } = await import("./__fixtures__/hosters.fixture.js");
const { getSpeakersFixture } = await import("./__fixtures__/speakers.fixture.js");

describe("run", () => {
  let setFailedMock: jest.SpiedFunction<typeof core.setFailed>;
  let inputServiceMock: MockProxy<InputService>;
  let coreServiceMock: MockProxy<CoreService>;
  let githubServiceMock: MockProxy<GitHubService>;

  const hosters = getHostersFixture();
  const speakers = getSpeakersFixture();

  beforeEach(async () => {
    jest.clearAllMocks();

    setFailedMock = jest.spyOn(core, "setFailed").mockImplementation();
    inputServiceMock = mock<InputService>();
    coreServiceMock = mock<CoreService>();
    githubServiceMock = mock<GitHubService>();

    container.snapshot();

    await container.unbind(InputService);
    container.bind(InputService).toConstantValue(inputServiceMock);
    await container.unbind(CORE_SERVICE_IDENTIFIER);
    container.bind<CoreService>(CORE_SERVICE_IDENTIFIER).toConstantValue(coreServiceMock);
    await container.unbind(GitHubService);
    container.bind<GitHubService>(GitHubService).toConstantValue(githubServiceMock);

    inputServiceMock.getIssueNumber.mockReturnValue(1);
    inputServiceMock.getShouldFix.mockReturnValue(true);
    inputServiceMock.getFailOnError.mockReturnValue(false);
    inputServiceMock.getHosters.mockReturnValue(hosters);

    inputServiceMock.getSpeakers.mockReturnValue(speakers);
  });

  afterEach(() => {
    container.restore();
  });

  it("should lint given valid issue and succeed", async () => {
    // Arrange
    const meetupIssue = getMeetupIssueFixture();
    inputServiceMock.getIssueParsedBody.mockReturnValue(meetupIssue.parsedBody);

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

    expect(coreServiceMock.setOutput).not.toHaveBeenCalled();
    expect(githubServiceMock.updateIssue).not.toHaveBeenCalled();

    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it("should lint given issue, fix it and succeed", async () => {
    // Arrange
    const meetupIssue = getMeetupIssueFixture();
    inputServiceMock.getIssueParsedBody.mockReturnValue({
      ...meetupIssue.parsedBody,
      hoster: [hosters[1].name], // This will trigger a fix
      cncf_link:
        "https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-test-meetup-event/",
    });

    githubServiceMock.getIssue.mockResolvedValue({
      number: meetupIssue.number,
      title: "", // Title will be updated
      labels: meetupIssue.labels,
      body: meetupIssue.body,
    });

    // Act
    await indexRunner.run();

    // Assert
    expect(coreServiceMock.debug).toHaveBeenCalledWith("Issue number: 1");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Start linting issue 1...");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Issue linted successfully.");
    expect(coreServiceMock.setOutput).not.toHaveBeenCalled();

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

    // Act
    await indexRunner.run();

    // Assert
    expect(coreServiceMock.debug).toHaveBeenCalledWith("Issue number: 1");
    expect(coreServiceMock.info).toHaveBeenCalledWith("Start linting issue 1...");

    expect(coreServiceMock.setOutput).toHaveBeenCalledWith(
      "lint-issues",
      "Hoster: Must not be empty\nAgenda: Must not be empty"
    );

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
