import { inject, injectable, injectFromBase } from "inversify";
import { string } from "zod";
import { AbstractEntityLinkLinterAdapter } from "./abstract-entity-link-linter.adapter.js";
import { MeetupIssue } from "../../services/meetup-issue.service.js";
import { LintError, type LintIssue } from "../lint.error.js";
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

  constructor(@inject(InputService) inputService: InputService) {
    const speakers = inputService.getSpeakers();
    super(speakers);
  }

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const result = await super.lint(meetupIssue, shouldFix);
    const fieldName = this.getFieldName();
    const fieldPath = `parsedBody.${fieldName}` as const;

    const agenda = result.parsedBody[fieldName]!;

    // Parse agenda lines
    const agendaLines = agenda.split("\n");

    const agendaEntries: AgendaEntry[] = [];

    const lintIssues: LintIssue[] = [];
    for (const agendaLine of agendaLines) {
      try {
        const agendaEntry = this.lintAgendaLine(agendaLine);
        if (agendaEntry) {
          agendaEntries.push(agendaEntry);
        }
      } catch (error) {
        if (error instanceof LintError) {
          lintIssues.push(...error.getIssues());
        } else {
          throw error;
        }
      }
    }

    if (lintIssues.length) {
      throw new LintError(lintIssues);
    }

    if (!agendaEntries.length) {
      throw new LintError([
        {
          field: fieldPath,
          value: agenda,
          message: this.getLintErrorMessage("Must contain at least one entry"),
        },
      ]);
    }

    const expectedAgenda = this.formatAgenda(agendaEntries);

    result.speakers = this.buildSpeakersList(agendaEntries);

    if (shouldFix) {
      result.parsedBody[fieldName] = expectedAgenda;
    }

    return result;
  }

  private buildSpeakersList(agendaEntries: AgendaEntry[]): SpeakerWithUrl[] {
    const seen = new Set<string>();
    const resolved: SpeakerWithUrl[] = [];

    for (const entry of agendaEntries) {
      for (const speakerName of entry.speakers) {
        if (seen.has(speakerName)) {
          continue;
        }
        const url = this.nameToUrl.get(speakerName);
        if (!url) {
          continue;
        }
        resolved.push({ name: speakerName, url });
        seen.add(speakerName);
      }
    }

    return resolved;
  }

  private lintAgendaLine(agendaLine: string): AgendaEntry | undefined {
    const fieldPath = "parsedBody.agenda" as const;

    if (agendaLine.trim() === "") {
      return;
    }

    const matches = agendaLine.match(AgendaLinterAdapter.AGENDA_LINE_REGEX);
    if (matches === null) {
      throw new LintError([
        {
          field: fieldPath,
          value: agendaLine,
          message: this.getLintErrorMessage(
            `Entry "${agendaLine}" must follow the format: "- <speaker(s)>: <talk_description>"`
          ),
        },
      ]);
    }

    const [, speakers, talkDescription] = matches;

    // Extract speaker names from potentially linked text
    const speakerList = this.extractEntityNames(speakers);

    for (const speaker of speakerList) {
      if (!speaker.length) {
        throw new LintError([
          {
            field: fieldPath,
            value: agendaLine,
            message: this.getLintErrorMessage("Speaker must not be empty"),
          },
        ]);
      }

      if (!this.isValidEntity(speaker)) {
        throw new LintError([
          {
            field: fieldPath,
            value: speaker,
            message: this.getLintErrorMessage(
              `Speaker "${speaker}" is not in the list of speakers`
            ),
          },
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

  protected getValidator() {
    return string().nonempty({
      message: "Must not be empty",
    });
  }

  protected getFieldName() {
    return "agenda" as const;
  }
}
