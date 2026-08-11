import { vi } from "vitest";
import { type MockProxy, mock } from "vitest-mock-extended";
import type { CoreService } from "./services/core.service.js";
import type { GitHubService as GitHubServiceContract } from "./services/github.service.js";
import type { InputService as InputServiceContract } from "./services/input.service.js";

const coreMock = {
	setFailed: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warning: vi.fn(),
	getInput: vi.fn(),
	getBooleanInput: vi.fn(),
	setOutput: vi.fn(),
};

vi.mock(import("@actions/core"), () => coreMock);

const core = await import("@actions/core");
const { container } = await import("./container.js");
const { InputService } = await import("./services/input.service.js");
const { CORE_SERVICE_IDENTIFIER } = await import("./services/core.service.js");
const { GitHubService } = await import("./services/github.service.js");
const { getMeetupIssueFixture } = await import(
	"./__fixtures__/meetup-issue.fixture.js"
);
const { getHostersFixture } = await import("./__fixtures__/hosters.fixture.js");
const { getSpeakersFixture } = await import(
	"./__fixtures__/speakers.fixture.js"
);

describe("index", () => {
	let setFailedMock: ReturnType<typeof vi.spyOn<typeof core, "setFailed">>;
	let inputServiceMock: MockProxy<InputServiceContract>;
	let coreServiceMock: MockProxy<CoreService>;
	let githubServiceMock: MockProxy<GitHubServiceContract>;

	beforeEach(() => {
		vi.clearAllMocks();

		setFailedMock = vi
			.spyOn(core, "setFailed")
			.mockImplementation(() => undefined);
		inputServiceMock = mock<InputServiceContract>();
		coreServiceMock = mock<CoreService>();
		githubServiceMock = mock<GitHubServiceContract>();

		container.snapshot();

		container.rebind(InputService).toConstantValue(inputServiceMock);
		container.rebind(CORE_SERVICE_IDENTIFIER).toConstantValue(coreServiceMock);
		container.rebind(GitHubService).toConstantValue(githubServiceMock);
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
