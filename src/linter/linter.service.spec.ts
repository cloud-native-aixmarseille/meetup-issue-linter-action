import { mock, MockProxy } from "jest-mock-extended";

import { LinterService } from "./linter.service";
import { LinterAdapter, LinterDependency } from "./adapter/linter.adapter";
import { getMeetupIssueFixture } from "../__fixtures__/meetup-issue.fixture";
import { LintError } from "./lint.error";
import { MeetupIssueService } from "src/services/meetup-issue.service";

class TestLinterWithoutDependency {}

class AnotherTestLinterWithoutDependency {}

class TestLinterWithDependency {}

describe("LinterService", () => {
  let meetupIssueService: MockProxy<MeetupIssueService>;
  let firstLinterAdapterWithoutDependencies: MockProxy<LinterAdapter>;
  let secondLinterAdapterWithoutDependencies: MockProxy<LinterAdapter>;
  let linterAdapterWithDependency: MockProxy<LinterAdapter>;

  beforeEach(() => {
    meetupIssueService = mock<MeetupIssueService>();

    firstLinterAdapterWithoutDependencies = mock<LinterAdapter>();
    firstLinterAdapterWithoutDependencies.constructor = TestLinterWithoutDependency;
    firstLinterAdapterWithoutDependencies.getDependencies.mockReturnValue([]);

    secondLinterAdapterWithoutDependencies = mock<LinterAdapter>();
    secondLinterAdapterWithoutDependencies.constructor = () => AnotherTestLinterWithoutDependency;
    secondLinterAdapterWithoutDependencies.getDependencies.mockReturnValue([]);

    // This linter has a dependency with first linter, so it should not be called as depending linters have failed
    linterAdapterWithDependency = mock<LinterAdapter>();
    linterAdapterWithDependency.constructor = TestLinterWithDependency;
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
        meetupIssueService
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

    it("should update meetup issue at the end of linting when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = true;

      // Arrange
      firstLinterAdapterWithoutDependencies.lint.mockResolvedValue(meetupIssue);
      linterAdapterWithDependency.lint.mockResolvedValue(meetupIssue);

      const linterService = new LinterService(
        [linterAdapterWithDependency, firstLinterAdapterWithoutDependencies],
        meetupIssueService
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
        meetupIssueService
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
  });
});
