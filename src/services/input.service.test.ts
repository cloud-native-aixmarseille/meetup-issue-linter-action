import { mock, MockProxy } from "jest-mock-extended";
import { InputService, InputNames } from "./input.service";
import { CoreService } from "./core.service";

describe("InputService", () => {
  let coreServiceMock: MockProxy<CoreService>;

  let service: InputService;

  beforeEach(() => {
    coreServiceMock = mock<CoreService>();

    service = new InputService(coreServiceMock);
  });

  describe("getIssueNumber", () => {
    it("should return the issue number", () => {
      coreServiceMock.getInput.mockImplementation((name: string) => {
        if (name === InputNames.IssueNumber) {
          return "1";
        }

        return "";
      });

      const result = service.getIssueNumber();

      expect(result).toBe(1);
      expect(coreServiceMock.getInput).toHaveBeenCalledWith(InputNames.IssueNumber, {
        required: true,
      });
    });
  });

  describe("getShouldFix", () => {
    it("should return the shouldFix value", () => {
      coreServiceMock.getBooleanInput.mockImplementation((name: string) => {
        if (name === InputNames.ShouldFix) {
          return true;
        }

        return false;
      });

      const result = service.getShouldFix();

      expect(result).toBe(true);
      expect(coreServiceMock.getBooleanInput).toHaveBeenCalledWith(InputNames.ShouldFix);
    });
  });

  describe("getGithubToken", () => {
    it("should return the github token", () => {
      coreServiceMock.getInput.mockImplementation((name: string) => {
        if (name === InputNames.GithubToken) {
          return "token";
        }

        return "";
      });

      const result = service.getGithubToken();

      expect(result).toBe("token");
      expect(coreServiceMock.getInput).toHaveBeenCalledWith(InputNames.GithubToken, {
        required: true,
      });
    });
  });
});
