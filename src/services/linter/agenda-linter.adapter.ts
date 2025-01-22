import { injectable } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abtract-zod-linter.adapter";
import { MeetupIssue } from "../meetup-issue.service";
import { LintError } from "./lint.error";

type AgendaEntry = {
  speaker: string;
  talkDescription: string;
};

@injectable()
export class AgendaLinterAdapter extends AbstractZodLinterAdapter {
  private static AGENDA_LINE_REGEX = /^- (.+): (.+)$/;

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
          `Entry "${agendaLine}" must follow the format: "- <speaker>: <talk_description>"`
        ),
      ]);
    }

    const [, speaker, talkDescription] = matches;
    return {
      speaker: speaker.trim(),
      talkDescription: talkDescription.trim(),
    };
  }

  protected getValidator() {
    return string().nonempty({
      message: "Must not be empty",
    });
  }

  protected getFieldName() {
    return "agenda" as const;
  }

  getPriority() {
    return 0;
  }
}
