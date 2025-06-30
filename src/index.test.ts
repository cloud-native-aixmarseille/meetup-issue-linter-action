import * as core from "@actions/core";
import { mock, MockProxy } from "jest-mock-extended";
import { container } from "./container";
import { InputService } from "./services/input.service";
import { CORE_SERVICE_IDENTIFIER, CoreService } from "./services/core.service";
import { GitHubService } from "./services/github.service";
import { getMeetupIssueFixture } from "./__fixtures__/meetup-issue.fixture";
import { getHostersFixture } from "./__fixtures__/hosters.fixture";
import { getSpeakersFixture } from "./__fixtures__/speakers.fixture";

describe("index", () => {
  let setFailedMock: jest.SpiedFunction<typeof core.setFailed>;
  let inputServiceMock: MockProxy<InputService>;
  let coreServiceMock: MockProxy<CoreService>;
  let githubServiceMock: MockProxy<GitHubService>;

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
    container.bind(CORE_SERVICE_IDENTIFIER).toConstantValue(coreServiceMock);
    await container.unbind(GitHubService);
    container.bind(GitHubService).toConstantValue(githubServiceMock);
  });

  afterEach(() => {
    container.restore();
  });

  it("calls run when imported without failure", async () => {
    // Arrange
    inputServiceMock.getIssueNumber.mockReturnValue(1);
    inputServiceMock.getShouldFix.mockReturnValue(true);
    inputServiceMock.getFailOnError.mockReturnValue(false);

    const hosters = getHostersFixture();
    inputServiceMock.getHosters.mockReturnValue(hosters);

    const speakers = getSpeakersFixture();
    inputServiceMock.getSpeakers.mockReturnValue(speakers);

    const meetupIssue = getMeetupIssueFixture();
    inputServiceMock.getIssueParsedBody.mockReturnValue(meetupIssue.parsedBody);

    githubServiceMock.getIssue.mockResolvedValue({
      number: meetupIssue.number,
      title: meetupIssue.title,
      labels: meetupIssue.labels,
      body: meetupIssue.body,
    });

    // Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await require("../src/index");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(setFailedMock).not.toHaveBeenCalled();
  });
});
