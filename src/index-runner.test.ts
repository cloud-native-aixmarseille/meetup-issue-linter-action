import * as core from "@actions/core";
import { mock, MockProxy } from "jest-mock-extended";
import { InputService } from "./services/input.service";
import * as indexRunner from "./index-runner";
import { container } from "./container";
import { getMeetupIssueFixture } from "./__fixtures__/meetup-issue.fixture";
import { CORE_SERVICE_IDENTIFIER, CoreService } from "./services/core.service";
import { GitHubService } from "./services/github.service";
import { getHostersFixture } from "./__fixtures__/hosters.fixture";
import { getSpeakersFixture } from "./__fixtures__/speakers.fixture";

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
