import { injectable } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abtract-zod-linter.adapter";
import { MeetupIssue } from "../../services/meetup-issue.service";
import { LintError } from "../lint.error";
import { InputService, SpeakerWithUrl } from "../../services/input.service";

type AgendaEntry = {
  speakers: string[];
  talkDescription: string;
};

@injectable()
export class AgendaLinterAdapter extends AbstractZodLinterAdapter {
  private static AGENDA_LINE_REGEX = /^- (.+?): (.+)$/;
  private static SPEAKER_LINK_REGEX = /\[([^\]]+)\]\([^)]+\)/g;

  private readonly speakers: [SpeakerWithUrl, ...SpeakerWithUrl[]];
  private readonly speakerNameToUrl: Map<string, string>;

  constructor(private readonly inputService: InputService) {
    super();

    this.speakers = this.inputService.getSpeakers();
    this.speakerNameToUrl = new Map(this.speakers.map((speaker) => [speaker.name, speaker.url]));
  }

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const result = await super.lint(meetupIssue, shouldFix);

    const agenda = result.body[this.getFieldName()]!;

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

    result.body[this.getFieldName()] = this.formatAgenda(agendaEntries);

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
    const speakerList = this.extractSpeakerNames(speakers);

    for (const speaker of speakerList) {
      if (!speaker.length) {
        throw new LintError([this.getLintErrorMessage("Speaker must not be empty")]);
      }

      if (!this.speakerNameToUrl.has(speaker)) {
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

  private extractSpeakerNames(speakersText: string): string[] {
    // Replace linked speakers with their display text
    const cleanedText = speakersText.replace(AgendaLinterAdapter.SPEAKER_LINK_REGEX, "$1");
    return cleanedText.split(",").map((s) => s.trim());
  }

  private formatAgenda(agendaEntries: AgendaEntry[]): string {
    // Format each agenda entry with linked speakers using provided URLs
    return agendaEntries
      .map((entry) => {
        const formattedSpeakers = entry.speakers.map((speaker) => {
          const url = this.speakerNameToUrl.get(speaker);
          return url ? `[${speaker}](${url})` : speaker;
        });
        return `- ${formattedSpeakers.join(", ")}: ${entry.talkDescription}`;
      })
      .join("\n");
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
