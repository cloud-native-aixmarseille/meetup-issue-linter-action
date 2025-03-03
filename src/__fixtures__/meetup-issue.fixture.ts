import { MeetupIssue } from "../services/meetup-issue.service";
import { getHostersFixture } from "./hosters.fixture";
import { getSpeakersFixture } from "./speakers.fixture";

export function getMeetupIssueFixture(override?: Partial<MeetupIssue>): MeetupIssue {
  const speakers = getSpeakersFixture();

  return {
    number: 1,
    title: "[Meetup] - 2021-12-31 - Meetup Event",
    labels: ["meetup"],
    body: {
      event_date: "2021-12-31",
      event_title: "Meetup Event",
      hoster: [getHostersFixture()[0]],
      event_description: "Description",
      agenda: `- ${speakers[0]}: Talk description One\n- ${speakers[1]}: Talk description Two`,
      meetup_link: "https://www.meetup.com/fr-FR/devops-aix-marseille/events/123456789",
      cncf_link:
        "https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-quiz-conteneurs-et-observabilite",
      drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
      ...(override?.body ?? {}),
    },
    ...(override ?? {}),
  };
}
