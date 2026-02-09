import { mock, MockProxy } from "jest-mock-extended";
import { CoreService } from "./core.service.js";
import { LoggerService } from "./logger.service.js";

describe("LoggerService", () => {
  let coreServiceMock: MockProxy<CoreService>;

  let loggerService: LoggerService;

  beforeEach(() => {
    coreServiceMock = mock<CoreService>();

    loggerService = new LoggerService(coreServiceMock);
  });

  describe("warn", () => {
    it("should call warning with the correct message", () => {
      const message = "This is a warning message";
      loggerService.warn(message);
      expect(coreServiceMock.warning).toHaveBeenCalledWith(message);
    });
  });

  describe("info", () => {
    it("should call info with the correct message", () => {
      const message = "This is an info message";

      loggerService.info(message);
      expect(coreServiceMock.info).toHaveBeenCalledWith(message);
    });
  });

  describe("debug", () => {
    it("should call debug with the correct message", () => {
      const message = "This is a debug message";

      loggerService.debug(message);
      expect(coreServiceMock.debug).toHaveBeenCalledWith(message);
    });
  });
});
