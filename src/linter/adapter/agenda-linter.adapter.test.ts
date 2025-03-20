import { AgendaLinterAdapter } from "./agenda-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";
import { MockProxy, mock } from "jest-mock-extended";
import { InputService } from "../../services/input.service";
import { getSpeakersFixture } from "../../__fixtures__/speakers.fixture";

describe("AgendaLinterAdapter", () => {
  let inputServiceMock: MockProxy<InputService>;

  let agendaLinterAdapter: AgendaLinterAdapter;

  beforeEach(() => {
    inputServiceMock = mock<InputService>();
    inputServiceMock.getSpeakers.mockReturnValue(getSpeakersFixture());

    agendaLinterAdapter = new AgendaLinterAdapter(inputServiceMock);
  });

  describe("lint", () => {
    it("should return the meetup issue if the Agenda is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should accept agenda description containing colon", async () => {
      // Arrange
      const speakers = getSpeakersFixture();

      const meetupIssue = getMeetupIssueFixture({
        body: {
          agenda: `- ${speakers[0]}: Talk Description: with colon`,
        },
      });
      const shouldFix = false;

      // Act
      const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should throw a LintError if the Agenda is invalid", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          agenda: "",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError(["Agenda: Must not be empty"]);

      await expect(agendaLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should throw a LintError if the Agenda line is invalid", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          agenda: "wrong-line",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        'Agenda: Entry "wrong-line" must follow the format: "- <speaker>: <talk_description>"',
      ]);

      await expect(agendaLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should throw a LintError if the Agenda line Speaker does not exist", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          agenda: "- Wrong Speaker: Talk Description",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        'Agenda: Speaker "Wrong Speaker" is not in the list of speakers',
      ]);

      await expect(agendaLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });
  });
});
