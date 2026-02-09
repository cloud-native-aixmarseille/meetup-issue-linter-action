import { MeetupIssue, MeetupIssueBody } from "../services/meetup-issue.service.js";
import { getHostersFixture } from "./hosters.fixture.js";
import { getSpeakersFixture } from "./speakers.fixture.js";

export function getMeetupIssueFixture(override?: Partial<MeetupIssue>): MeetupIssue {
  const speakers = getSpeakersFixture();
  const hosters = getHostersFixture();

  const parsedBody: MeetupIssueBody = {
    event_date: "2021-12-31",
    event_title: "December - Meetup Event",
    hoster: [`[${hosters[0].name}](${hosters[0].url})`],
    event_description: "This is the event description.",
    agenda:
      `- [${speakers[0].name}](${speakers[0].url}): Talk description One\n` +
      `- [${speakers[1].name}](${speakers[1].url}): Talk description Two`,
    meetup_link: "https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
    cncf_link:
      "https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-test-meetup-event",
    drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
    ...(override?.parsedBody ?? {}),
  };

  const body = `### Event Title

${parsedBody.event_title}

### Event Date

${parsedBody.event_date}

### Hoster

${parsedBody.hoster?.join(",")}

### Event Description

${parsedBody.event_description}

### Agenda

${parsedBody.agenda}

### Meetup Link

${parsedBody.meetup_link}

### CNCF Link

${parsedBody.cncf_link}

### Drive Link

${parsedBody.drive_link}
`;

  return {
    number: 1,
    title: "[Meetup] - 2021-12-31 - December - Meetup Event",
    labels: ["meetup", "hoster:confirmed"],
    body,
    ...(override ?? {}),
    parsedBody,
  };
}
