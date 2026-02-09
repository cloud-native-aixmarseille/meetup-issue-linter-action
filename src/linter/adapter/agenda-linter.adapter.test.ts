import { AgendaLinterAdapter } from "./agenda-linter.adapter.js";
import { LintError } from "../lint.error.js";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";
import { MockProxy, mock } from "jest-mock-extended";
import { InputService } from "../../services/input.service.js";
import { getSpeakersFixture } from "../../__fixtures__/speakers.fixture.js";
import { MeetupIssueService } from "../../services/meetup-issue.service.js";

describe("AgendaLinterAdapter", () => {
  let inputServiceMock: MockProxy<InputService>;
  let meetupIssueService: MockProxy<MeetupIssueService>;

  let agendaLinterAdapter: AgendaLinterAdapter;

  beforeEach(() => {
    inputServiceMock = mock<InputService>();
    inputServiceMock.getSpeakers.mockReturnValue(getSpeakersFixture());

    meetupIssueService = mock<MeetupIssueService>();

    agendaLinterAdapter = new AgendaLinterAdapter(meetupIssueService, inputServiceMock);
  });

  describe("lint", () => {
    const speakers = getSpeakersFixture();

    it.each([
      {
        description: "single speaker without link",
        agenda: `- ${speakers[0].name}: Talk Description`,
      },
      {
        description: "description containing colon",
        agenda: `- ${speakers[0].name}: Talk Description with colon:`,
      },
      {
        description: "multiple speakers without links",
        agenda: `- ${speakers[0].name}, ${speakers[1].name}: Talk Description with multiple speakers`,
      },
      {
        description: "some speakers having links and others not",
        agenda: [
          `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with speaker with link`,
          `- ${speakers[0].name}: Talk Description with speaker without link`,
          `- [${speakers[0].name}](https://example.com/speaker1), ${speakers[1].name}: Talk Description with multiple speakers with link and without`,
        ].join("\n"),
      },
    ])(
      "should return the meetup issue if the Agenda is valid with $description",
      async ({ agenda }) => {
        // Arrange
        const shouldFix = false;

        const meetupIssue = getMeetupIssueFixture({
          body: `### Agenda:\n\n${agenda}`,
          parsedBody: {
            agenda,
          },
        });

        // Act
        const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

        // Assert
        expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
        expect(result).toEqual(meetupIssue);
      }
    );

    it("should fix the Agenda if shouldFix is true", async () => {
      // Arrange
      const speakers = getSpeakersFixture();

      const agenda = [
        `- ${speakers[0].name}: Talk Description with space at the end `,
        `- ${speakers[0].name} : Talk Description with speakers containing space`,
        `- ${speakers[0].name},  ${speakers[1].name}: Talk Description with multiple speakers containing space`,
      ].join("\n");

      const meetupIssue = getMeetupIssueFixture({
        body: `### Agenda:\n\n${agenda}`,
        parsedBody: {
          agenda,
        },
      });

      const shouldFix = true;

      // Act
      const result = await agendaLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(meetupIssueService.updateMeetupIssueBodyField).toHaveBeenCalledWith(
        meetupIssue,
        "agenda"
      );

      const expectedAgenda =
        `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with space at the end\n` +
        `- [${speakers[0].name}](https://example.com/speaker1): Talk Description with speakers containing space\n` +
        `- [${speakers[0].name}](https://example.com/speaker1), [${speakers[1].name}](https://example.com/speaker2): Talk Description with multiple speakers containing space`;

      expect(result.parsedBody.agenda).toBe(expectedAgenda);
    });

    it.each([
      {
        description: "agenda is empty",
        agenda: "",
        error: "Must not be empty",
      },
      {
        description: "agenda has no entries",
        agenda: "\n\n",
        error: "Must contain at least one entry",
      },
      {
        description: "agenda entry is wrongly formatted",
        agenda: "wrong-line",
        error: `Entry "wrong-line" must follow the format: "- <speaker(s)>: <talk_description>"`,
      },
      {
        description: "agenda entry speaker is empty",
        agenda: "- ,: Talk Description",
        error: "Speaker must not be empty",
      },
      {
        description: "agenda entry speaker does not exist",
        agenda: "- Wrong Speaker: Talk Description",
        error: `Speaker "Wrong Speaker" is not in the list of speakers`,
      },
    ])("should throw a LintError if $description", async ({ agenda, error }) => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        parsedBody: {
          agenda,
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([`Agenda: ${error}`]);

      await expect(agendaLinterAdapter.lint(invalidMeetupIssue, shouldFix)).rejects.toStrictEqual(
        expectedError
      );

      expect(meetupIssueService.updateMeetupIssueBodyField).not.toHaveBeenCalled();
    });
  });

  describe("getDependencies", () => {
    it("should return an empty array", () => {
      // Act
      const result = agendaLinterAdapter.getDependencies();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
