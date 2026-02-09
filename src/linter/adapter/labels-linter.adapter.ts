import { injectable } from "inversify";
import { LinterAdapter } from "./linter.adapter.js";
import { MeetupIssue } from "../../services/meetup-issue.service.js";
import { LintError } from "../lint.error.js";

@injectable()
export class LabelsLinterAdapter implements LinterAdapter {
  private static LABEL_MEETUP = "meetup";
  private static LABEL_HOSTER_NEEDED = "hoster:needed";
  private static LABEL_HOSTER_CONFIRMED = "hoster:confirmed";
  private static LABEL_SPEAKERS_NEEDED = "speakers:needed";
  private static LABEL_SPEAKERS_CONFIRMED = "speakers:confirmed";

  private static ALLOWED_LABELS = [
    LabelsLinterAdapter.LABEL_MEETUP,
    LabelsLinterAdapter.LABEL_HOSTER_NEEDED,
    LabelsLinterAdapter.LABEL_HOSTER_CONFIRMED,
    LabelsLinterAdapter.LABEL_SPEAKERS_NEEDED,
    LabelsLinterAdapter.LABEL_SPEAKERS_CONFIRMED,
  ];

  async lint(meetupIssue: MeetupIssue, shouldFix: boolean): Promise<MeetupIssue> {
    const expectedLabels = [LabelsLinterAdapter.LABEL_MEETUP];

    // Add hoster needed label if hoster is needed
    if (meetupIssue.parsedBody.hoster?.length === 0) {
      expectedLabels.push(LabelsLinterAdapter.LABEL_HOSTER_NEEDED);
    } else {
      expectedLabels.push(LabelsLinterAdapter.LABEL_HOSTER_CONFIRMED);
    }

    // Add speakers needed label if speakers are needed
    if (meetupIssue.parsedBody.agenda?.length === 0) {
      expectedLabels.push(LabelsLinterAdapter.LABEL_SPEAKERS_NEEDED);
    }

    const meetupIssueLabels = meetupIssue.labels;

    // Ensure that the meetup issue has the expected labels and no other labels
    const missingLabels = expectedLabels.filter((label) => !meetupIssueLabels.includes(label));

    const extraLabels = meetupIssueLabels.filter(
      (label) => !LabelsLinterAdapter.ALLOWED_LABELS.includes(label)
    );

    if (missingLabels.length === 0 && extraLabels.length === 0) {
      return meetupIssue;
    }

    if (shouldFix) {
      meetupIssue.labels = expectedLabels;
      return meetupIssue;
    }

    const lintErrors: string[] = [];
    if (missingLabels.length > 0) {
      lintErrors.push(`Labels: Missing label(s) "${missingLabels.join(", ")}"`);
    }

    if (extraLabels.length > 0) {
      lintErrors.push(`Labels: Extra label(s) "${extraLabels.join(", ")}"`);
    }

    throw new LintError(lintErrors);
  }

  getDependencies() {
    return [];
  }
}
