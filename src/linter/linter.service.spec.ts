import { mock, MockProxy } from "jest-mock-extended";
import { LinterService } from "./linter.service.js";
import { LinterAdapter, LinterDependency } from "./adapter/linter.adapter.js";
import { getMeetupIssueFixture } from "../__fixtures__/meetup-issue.fixture.js";
import { LintError } from "./lint.error.js";
import { MeetupIssueService } from "../services/meetup-issue.service.js";
import { LoggerService } from "../services/logger.service.js";

class TestLinterWithoutDependency {}

class AnotherTestLinterWithoutDependency {}

class TestLinterWithDependency {}

describe("LinterService", () => {
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let loggerService: MockProxy<LoggerService>;
  let firstLinterAdapterWithoutDependencies: MockProxy<LinterAdapter>;
  let secondLinterAdapterWithoutDependencies: MockProxy<LinterAdapter>;
  let linterAdapterWithDependency: MockProxy<LinterAdapter>;

  beforeEach(() => {
    meetupIssueService = mock<MeetupIssueService>();
    loggerService = mock<LoggerService>();

    firstLinterAdapterWithoutDependencies = mock<LinterAdapter>();
    firstLinterAdapterWithoutDependencies.constructor = TestLinterWithoutDependency;
    firstLinterAdapterWithoutDependencies.getName.mockReturnValue("TestLinterWithoutDependency");
    firstLinterAdapterWithoutDependencies.getDependencies.mockReturnValue([]);

    secondLinterAdapterWithoutDependencies = mock<LinterAdapter>();
    secondLinterAdapterWithoutDependencies.constructor = () => AnotherTestLinterWithoutDependency;
    secondLinterAdapterWithoutDependencies.getName.mockReturnValue(
      "AnotherTestLinterWithoutDependency"
    );
    secondLinterAdapterWithoutDependencies.getDependencies.mockReturnValue([]);

    // This linter has a dependency with first linter, so it should not be called as depending linters have failed
    linterAdapterWithDependency = mock<LinterAdapter>();
    linterAdapterWithDependency.constructor = TestLinterWithDependency;
    linterAdapterWithDependency.getName.mockReturnValue("TestLinterWithDependency");
    linterAdapterWithDependency.getDependencies.mockReturnValue([
      TestLinterWithoutDependency as LinterDependency,
    ]);
  });

  describe("lint", () => {
    it("should call lint on each linter respecting dependencies", async () => {
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Arrange
      firstLinterAdapterWithoutDependencies.lint.mockResolvedValue(meetupIssue);
      linterAdapterWithDependency.lint.mockResolvedValue(meetupIssue);

      const linterService = new LinterService(
        [linterAdapterWithDependency, firstLinterAdapterWithoutDependencies],
        meetupIssueService,
        loggerService
      );

      // Act
      await linterService.lint(meetupIssue, shouldFix);

      // Assert
      expect(firstLinterAdapterWithoutDependencies.lint).toHaveBeenCalled();
      expect(linterAdapterWithDependency.lint).toHaveBeenCalled();

      // Assert that the linters were called in order of priority
      const firstLinterOrder =
        firstLinterAdapterWithoutDependencies.lint.mock.invocationCallOrder[0];
      const linterAdapterWithDependencyOrder =
        linterAdapterWithDependency.lint.mock.invocationCallOrder[0];

      expect(firstLinterOrder).toBeLessThan(linterAdapterWithDependencyOrder);

      expect(meetupIssueService.updateMeetupIssue).not.toHaveBeenCalled();
    });

    it("should throw when two linters share the same constructor", async () => {
      class DuplicateLinter {}

      const meetupIssue = getMeetupIssueFixture();

      const firstDuplicateLinter = mock<LinterAdapter>();
      firstDuplicateLinter.constructor = DuplicateLinter;
      firstDuplicateLinter.getName.mockReturnValue("DuplicateLinter");
      firstDuplicateLinter.getDependencies.mockReturnValue([]);

      const secondDuplicateLinter = mock<LinterAdapter>();
      secondDuplicateLinter.constructor = DuplicateLinter;
      secondDuplicateLinter.getName.mockReturnValue("DuplicateLinter");
      secondDuplicateLinter.getDependencies.mockReturnValue([]);

      const linterService = new LinterService(
        [firstDuplicateLinter, secondDuplicateLinter],
        meetupIssueService,
        loggerService
      );

      await expect(linterService.lint(meetupIssue, false)).rejects.toThrow(
        'Linter "DuplicateLinter" already exists.'
      );

      expect(firstDuplicateLinter.lint).not.toHaveBeenCalled();
      expect(secondDuplicateLinter.lint).not.toHaveBeenCalled();
      expect(meetupIssueService.updateMeetupIssue).not.toHaveBeenCalled();
    });

    it("should throw when a circular dependency is detected", async () => {
      class CircularLinterA {}
      class CircularLinterB {}

      const meetupIssue = getMeetupIssueFixture();

      const circularLinterA = mock<LinterAdapter>();
      circularLinterA.constructor = CircularLinterA;
      circularLinterA.getName.mockReturnValue("CircularLinterA");
      circularLinterA.getDependencies.mockReturnValue([CircularLinterB as LinterDependency]);

      const circularLinterB = mock<LinterAdapter>();
      circularLinterB.constructor = CircularLinterB;
      circularLinterB.getName.mockReturnValue("CircularLinterB");
      circularLinterB.getDependencies.mockReturnValue([CircularLinterA as LinterDependency]);

      const linterService = new LinterService(
        [circularLinterA, circularLinterB],
        meetupIssueService,
        loggerService
      );

      await expect(linterService.lint(meetupIssue, false)).rejects.toThrow(
        'Circular dependency detected involving "CircularLinterA"'
      );

      expect(circularLinterA.lint).not.toHaveBeenCalled();
      expect(circularLinterB.lint).not.toHaveBeenCalled();
      expect(meetupIssueService.updateMeetupIssue).not.toHaveBeenCalled();
    });

    it("should update meetup issue at the end of linting when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = true;

      // Arrange
      firstLinterAdapterWithoutDependencies.lint.mockResolvedValue(meetupIssue);
      linterAdapterWithDependency.lint.mockResolvedValue(meetupIssue);

      const linterService = new LinterService(
        [linterAdapterWithDependency, firstLinterAdapterWithoutDependencies],
        meetupIssueService,
        loggerService
      );

      // Act
      await linterService.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssue).toHaveBeenCalledWith(meetupIssue, meetupIssue);
    });

    it("should throw a LintError if any linter fails", async () => {
      // Arrange
      firstLinterAdapterWithoutDependencies.lint.mockRejectedValue(
        new LintError(["First Lint error"])
      );

      secondLinterAdapterWithoutDependencies.lint.mockRejectedValue(
        new LintError(["Second Lint error"])
      );

      const linterService = new LinterService(
        [
          firstLinterAdapterWithoutDependencies,
          secondLinterAdapterWithoutDependencies,
          linterAdapterWithDependency,
        ],
        meetupIssueService,
        loggerService
      );

      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError(["First Lint error", "Second Lint error"]);
      await expect(linterService.lint(meetupIssue, shouldFix)).rejects.toStrictEqual(expectedError);

      expect(firstLinterAdapterWithoutDependencies.lint).toHaveBeenCalled();
      expect(secondLinterAdapterWithoutDependencies.lint).toHaveBeenCalled();

      expect(linterAdapterWithDependency.lint).not.toHaveBeenCalled();

      expect(meetupIssueService.updateMeetupIssue).not.toHaveBeenCalled();
    });

    it("should rethrow non-LintError errors", async () => {
      const unexpectedError = new Error("boom");

      firstLinterAdapterWithoutDependencies.lint.mockRejectedValue(unexpectedError);

      const linterService = new LinterService(
        [firstLinterAdapterWithoutDependencies, secondLinterAdapterWithoutDependencies],
        meetupIssueService,
        loggerService
      );

      const meetupIssue = getMeetupIssueFixture();

      await expect(linterService.lint(meetupIssue, false)).rejects.toBe(unexpectedError);

      expect(secondLinterAdapterWithoutDependencies.lint).not.toHaveBeenCalled();
      expect(meetupIssueService.updateMeetupIssue).not.toHaveBeenCalled();
    });
  });
});
