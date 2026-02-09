import { inject, injectable, injectFromBase } from "inversify";
import { string } from "zod";
import { AbstractEntityLinkLinterAdapter } from "./abstract-entity-link-linter.adapter.js";
import { MeetupIssue, MeetupIssueService } from "../../services/meetup-issue.service.js";
import { LintError } from "../lint.error.js";
import { InputService, SpeakerWithUrl } from "../../services/input.service.js";

type AgendaEntry = {
  speakers: string[];
  talkDescription: string;
};

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class AgendaLinterAdapter extends AbstractEntityLinkLinterAdapter<SpeakerWithUrl> {
  private static AGENDA_LINE_REGEX = /^- (.+?): (.+)$/;

  constructor(
    @inject(MeetupIssueService) meetupIssueService: MeetupIssueService,
    @inject(InputService) inputService: InputService
  ) {
    const speakers = inputService.getSpeakers();
    super(meetupIssueService, speakers);
  }

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const result = await super.lint(meetupIssue, shouldFix);
    const fieldName = this.getFieldName();

    const agenda = result.parsedBody[fieldName]!;

    // Parse agenda lines
    const agendaLines = agenda.split("\n");

    const agendaEntries: AgendaEntry[] = [];

    const lintErrors: string[] = [];
    for (const agendaLine of agendaLines) {
      try {
        const agendaEntry = this.lintAgendaLine(agendaLine);
        if (agendaEntry) {
          agendaEntries.push(agendaEntry);
        }
      } catch (error) {
        if (error instanceof LintError) {
          lintErrors.push(...error.getMessages());
        } else {
          throw error;
        }
      }
    }

    if (lintErrors.length) {
      throw new LintError(lintErrors);
    }

    if (!agendaEntries.length) {
      throw new LintError([this.getLintErrorMessage("Must contain at least one entry")]);
    }

    const expectedAgenda = this.formatAgenda(agendaEntries);

    if (shouldFix && result.parsedBody[fieldName] !== expectedAgenda) {
      result.parsedBody[fieldName] = expectedAgenda;
      this.meetupIssueService.updateMeetupIssueBodyField(result, fieldName);
    }

    return result;
  }

  private lintAgendaLine(agendaLine: string): AgendaEntry | undefined {
    if (agendaLine.trim() === "") {
      return;
    }

    const matches = agendaLine.match(AgendaLinterAdapter.AGENDA_LINE_REGEX);
    if (matches === null) {
      throw new LintError([
        this.getLintErrorMessage(
          `Entry "${agendaLine}" must follow the format: "- <speaker(s)>: <talk_description>"`
        ),
      ]);
    }

    const [, speakers, talkDescription] = matches;

    // Extract speaker names from potentially linked text
    const speakerList = this.extractEntityNames(speakers);

    for (const speaker of speakerList) {
      if (!speaker.length) {
        throw new LintError([this.getLintErrorMessage("Speaker must not be empty")]);
      }

      if (!this.isValidEntity(speaker)) {
        throw new LintError([
          this.getLintErrorMessage(`Speaker "${speaker}" is not in the list of speakers`),
        ]);
      }
    }

    return {
      speakers: speakerList,
      talkDescription: talkDescription.trim(),
    };
  }

  private formatAgenda(agendaEntries: AgendaEntry[]): string {
    // Format each agenda entry with linked speakers using provided URLs
    return agendaEntries
      .map((entry) => {
        const formattedSpeakers = entry.speakers.map((speaker) =>
          this.formatEntityWithLink(speaker)
        );
        return `- ${formattedSpeakers.join(", ")}: ${entry.talkDescription}`;
      })
      .join("\n");
  }

  protected updateMeetupIssueIfNeeded(): void {
    // No need to update the meetup issue here, it is done in the lint method
    return;
  }

  protected getValidator() {
    return string().nonempty({
      message: "Must not be empty",
    });
  }

  protected getFieldName() {
    return "agenda" as const;
  }
}
