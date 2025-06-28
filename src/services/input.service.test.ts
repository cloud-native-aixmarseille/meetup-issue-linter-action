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
      coreServiceMock.getInput.calledWith(InputNames.IssueNumber).mockReturnValue("1");

      const result = service.getIssueNumber();

      expect(result).toBe(1);
      expect(coreServiceMock.getInput).toHaveBeenCalledWith(InputNames.IssueNumber, {
        required: true,
      });
    });
  });

  describe("getIssueParsedBody", () => {
    it("should return the parsed issue body", () => {
      coreServiceMock.getInput
        .calledWith(InputNames.IssueParsedBody)
        .mockReturnValue('{ "key": "value" }');

      const result = service.getIssueParsedBody();

      expect(result).toEqual({ key: "value" });
      expect(coreServiceMock.getInput).toHaveBeenCalledWith(InputNames.IssueParsedBody, {
        required: true,
      });
    });
  });

  describe("getHosters", () => {
    it("should return the hosters", () => {
      coreServiceMock.getInput
        .calledWith(InputNames.Hosters)
        .mockReturnValue(
          '[{"name": "hoster1", "url": "https://example.com/hoster1"}, {"name": "hoster2", "url": "https://example.com/hoster2"}]'
        );

      const result = service.getHosters();

      expect(result).toEqual([
        { name: "hoster1", url: "https://example.com/hoster1" },
        { name: "hoster2", url: "https://example.com/hoster2" },
      ]);
      expect(coreServiceMock.getInput).toHaveBeenCalledWith(InputNames.Hosters, {
        required: true,
      });
    });

    it("should throw an error if the hosters input is not an array", () => {
      coreServiceMock.getInput.calledWith(InputNames.Hosters).mockReturnValue('"hoster1"');

      expect(() => service.getHosters()).toThrow('"hosters" input must be an array');
    });

    it("should throw an error if the hosters input is empty", () => {
      coreServiceMock.getInput.calledWith(InputNames.Hosters).mockReturnValue("[]");

      expect(() => service.getHosters()).toThrow('"hosters" input must not be empty');
    });

    it("should throw an error if the hosters input is not an array of valid objects", () => {
      coreServiceMock.getInput.calledWith(InputNames.Hosters).mockReturnValue("[1]");

      expect(() => service.getHosters()).toThrow(
        '"hosters" input value "1" (number) must be an object'
      );
    });

    it("should throw an error if the hosters input objects are missing name property", () => {
      coreServiceMock.getInput
        .calledWith(InputNames.Hosters)
        .mockReturnValue('[{"url": "https://example.com"}]');

      expect(() => service.getHosters()).toThrow('must have a "name" property of type string');
    });

    it("should throw an error if the hosters input objects are missing url property", () => {
      coreServiceMock.getInput
        .calledWith(InputNames.Hosters)
        .mockReturnValue('[{"name": "hoster1"}]');

      expect(() => service.getHosters()).toThrow('must have a "url" property of type string');
    });
  });

  describe("getSpeakers", () => {
    it("should return the speakers", () => {
      coreServiceMock.getInput
        .calledWith(InputNames.Speakers)
        .mockReturnValue(
          '[{"name": "speaker1", "url": "https://example.com/speaker1"}, {"name": "speaker2", "url": "https://example.com/speaker2"}]'
        );

      const result = service.getSpeakers();

      expect(result).toEqual([
        { name: "speaker1", url: "https://example.com/speaker1" },
        { name: "speaker2", url: "https://example.com/speaker2" },
      ]);
      expect(coreServiceMock.getInput).toHaveBeenCalledWith(InputNames.Speakers, {
        required: true,
      });
    });

    it("should throw an error if the speakers input is not an array", () => {
      coreServiceMock.getInput.calledWith(InputNames.Speakers).mockReturnValue('"speaker1"');

      expect(() => service.getSpeakers()).toThrow('"speakers" input must be an array');
    });

    it("should throw an error if the speakers input is empty", () => {
      coreServiceMock.getInput.calledWith(InputNames.Speakers).mockReturnValue("[]");

      expect(() => service.getSpeakers()).toThrow('"speakers" input must not be empty');
    });

    it("should throw an error if the speakers input is not an array of valid objects", () => {
      coreServiceMock.getInput.calledWith(InputNames.Speakers).mockReturnValue("[1]");

      expect(() => service.getSpeakers()).toThrow(
        '"speakers" input value "1" (number) must be an object'
      );
    });

    it("should throw an error if the speakers input objects are missing name property", () => {
      coreServiceMock.getInput
        .calledWith(InputNames.Speakers)
        .mockReturnValue('[{"url": "https://example.com"}]');

      expect(() => service.getSpeakers()).toThrow('must have a "name" property of type string');
    });

    it("should throw an error if the speakers input objects are missing url property", () => {
      coreServiceMock.getInput
        .calledWith(InputNames.Speakers)
        .mockReturnValue('[{"name": "speaker1"}]');

      expect(() => service.getSpeakers()).toThrow('must have a "url" property of type string');
    });
  });

  describe("getShouldFix", () => {
    it("should return the shouldFix value", () => {
      coreServiceMock.getBooleanInput.calledWith(InputNames.ShouldFix).mockReturnValue(true);

      const result = service.getShouldFix();

      expect(result).toBe(true);
      expect(coreServiceMock.getBooleanInput).toHaveBeenCalledWith(InputNames.ShouldFix);
    });
  });

  describe("getFailOnError", () => {
    it("should return the failOnError value", () => {
      coreServiceMock.getBooleanInput.calledWith(InputNames.FailOnError).mockReturnValue(true);

      const result = service.getFailOnError();

      expect(result).toBe(true);
      expect(coreServiceMock.getBooleanInput).toHaveBeenCalledWith(InputNames.FailOnError);
    });
  });

  describe("getGithubToken", () => {
    it("should return the github token", () => {
      coreServiceMock.getInput.calledWith(InputNames.GithubToken).mockReturnValue("token");

      const result = service.getGithubToken();

      expect(result).toBe("token");
      expect(coreServiceMock.getInput).toHaveBeenCalledWith(InputNames.GithubToken, {
        required: true,
      });
    });
  });
});
