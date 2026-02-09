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
const { container } = await import("./container.js");
const { InputService } = await import("./services/input.service.js");
const { CORE_SERVICE_IDENTIFIER } = await import("./services/core.service.js");
const { GitHubService } = await import("./services/github.service.js");
const { getMeetupIssueFixture } = await import("./__fixtures__/meetup-issue.fixture.js");
const { getHostersFixture } = await import("./__fixtures__/hosters.fixture.js");
const { getSpeakersFixture } = await import("./__fixtures__/speakers.fixture.js");

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
    await import("../src/index.js");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(setFailedMock).not.toHaveBeenCalled();
  });
});
