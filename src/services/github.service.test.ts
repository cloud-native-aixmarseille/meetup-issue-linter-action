import { jest } from "@jest/globals";
import { mock, MockProxy } from "jest-mock-extended";
import type { GitHubService as GitHubServiceType } from "./github.service.js";
import { InputService } from "./input.service.js";

const getIssueMock = jest.fn();
const updateIssueMock = jest.fn();
const getOctokitMock = jest.fn().mockReturnValue({
  rest: {
    issues: {
      get: getIssueMock,
      update: updateIssueMock,
    },
  },
});

jest.unstable_mockModule("@actions/github", () => ({
  context: { repo: { owner: "owner", repo: "repo" } },
  getOctokit: (...args: unknown[]) => getOctokitMock(...args),
}));

describe("GitHubService", () => {
  let inputServiceMock: MockProxy<InputService>;
  let GitHubService: typeof import("./github.service.js").GitHubService;
  let service: GitHubServiceType;

  beforeAll(async () => {
    ({ GitHubService } = await import("./github.service.js"));
  });

  beforeEach(() => {
    inputServiceMock = mock<InputService>();
    inputServiceMock.getGithubToken.mockReturnValue("token");

    getOctokitMock.mockClear();
    getIssueMock.mockReset();
    updateIssueMock.mockReset();

    service = new GitHubService(inputServiceMock);
  });

  describe("getIssue", () => {
    it("returns mapped issue with normalized labels", async () => {
      getIssueMock.mockResolvedValue({
        data: {
          number: 1,
          title: "title",
          body: "body",
          labels: ["label-1", { name: "label-2" }, { name: null }],
        },
      });

      const issue = await service.getIssue(1);

      expect(issue).toEqual({
        number: 1,
        title: "title",
        body: "body",
        labels: ["label-1", "label-2"],
      });
      expect(getOctokitMock).toHaveBeenCalledWith("token");
      expect(getIssueMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
      });
    });
  });

  describe("updateIssue", () => {
    it("calls octokit update with provided fields", async () => {
      updateIssueMock.mockResolvedValue({});

      await service.updateIssue(2, { title: "new-title", body: "new-body", labels: ["a"] });

      expect(getOctokitMock).toHaveBeenCalledWith("token");
      expect(updateIssueMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 2,
        title: "new-title",
        body: "new-body",
        labels: ["a"],
      });
    });
  });

  describe("getOctokit caching", () => {
    it("reuses the same octokit instance", async () => {
      getIssueMock.mockResolvedValue({ data: { number: 1, title: "t", body: "b", labels: [] } });

      await service.getIssue(1);
      getOctokitMock.mockClear();

      updateIssueMock.mockResolvedValue({});
      await service.updateIssue(1, { title: "next" });

      expect(getOctokitMock).not.toHaveBeenCalled();
    });
  });
});
