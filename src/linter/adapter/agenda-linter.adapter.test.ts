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
          agenda: `- ${speakers[0].name}: Talk Description: with colon`,
        },
      });
      const shouldFix = false;

      // Act
      const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should accept multiple speakers for an agenda entry", async () => {
      // Arrange
      const speakers = getSpeakersFixture();

      const meetupIssue = getMeetupIssueFixture({
        body: {
          agenda: `- ${speakers[0].name}, ${speakers[1].name}: Talk Description with multiple speakers`,
        },
      });
      const shouldFix = false;

      // Act
      const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should fix the Agenda if shouldFix is true", async () => {
      // Arrange
      const speakers = getSpeakersFixture();

      const agenda = [
        `- ${speakers[0].name}: Talk Description with space at the end `,
        `- ${speakers[0].name} : Talk Description with speakers containing space`,
        `- ${speakers[0].name},  ${speakers[1].name}: Talk Description with multiple speakers containing space`,
      ].join("\n");

      const meetupIssue = getMeetupIssueFixture({
        body: {
          agenda,
        },
      });

      const shouldFix = true;

      // Act
      const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result.body.agenda).toBe(
        `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with space at the end\n` +
          `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with speakers containing space\n` +
          `- [${speakers[0].name}](https://example.com/speaker1), [${speakers[1].name}](https://example.com/speaker2): Talk Description with multiple speakers containing space`
      );
    });

    it("should handle mixed scenarios with some speakers having links and others not", async () => {
      // Arrange
      const speakers = getSpeakersFixture();

      const agenda = [
        `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with speaker with link`,
        `- ${speakers[0].name}: Talk Description with speaker without link`,
        `- [${speakers[0].name}](https://example.com/speaker1), ${speakers[1].name}: Talk Description with multiple speakers with link and without`,
      ].join("\n");

      const meetupIssue = getMeetupIssueFixture({
        body: {
          agenda,
        },
      });

      const shouldFix = false;

      // Act
      const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result.body.agenda).toBe(
        `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with speaker with link\n` +
          `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with speaker without link\n` +
          `- [${speakers[0].name}](https://example.com/speaker1), [${speakers[1].name}](https://example.com/speaker2): Talk Description with multiple speakers with link and without`
      );
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

    it("should throw a LintError if the Agenda has agenda entries", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          agenda: "\n\n",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError(["Agenda: Must contain at least one entry"]);

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
        'Agenda: Entry "wrong-line" must follow the format: "- <speaker(s)>: <talk_description>"',
      ]);

      await expect(agendaLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );
    });

    it("should throw a LintError if the Agenda speaker is empty", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          agenda: "- ,: Talk Description",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError(["Agenda: Speaker must not be empty"]);

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
