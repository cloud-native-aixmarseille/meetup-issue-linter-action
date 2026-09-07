import type { MeetupEvent } from "../src/index.js";

export function createTestEvent(
	overrides: Partial<MeetupEvent> = {},
): MeetupEvent {
	return {
		schemaVersion: 1,
		identity: {
			repository: "cloud-native-aixmarseille/meetups",
			issueNumber: 42,
		},
		issueState: "open",
		issueTitle: "[Meetup] - 2026-09-30 - Cloud Native Evening",
		labels: ["meetup", "hoster:confirmed", "speakers:confirmed"],
		eventTitle: "Cloud Native Evening",
		date: "2026-09-30",
		description: "An evening about cloud-native technology",
		host: { id: "host-1", displayName: "Aix Tech Hub" },
		agenda: [
			{
				speakers: [{ id: "speaker-1", displayName: "Ada Lovelace" }],
				description: "Reliable platforms",
			},
		],
		publicationLinks: {
			meetup:
				"https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
			community:
				"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/cloud-native-evening",
			assets: "https://drive.google.com/drive/folders/folder-1",
		},
		occurrenceStatus: "scheduled",
		timeZone: "Europe/Paris",
		confirmations: { host: true, speakers: true },
		logistics: {
			aperitif: "planned",
			postEventVenue: "not-planned",
		},
		operationalChecklists: {
			slidesAndContent: [],
			communication: [],
			postEvent: [],
		},
		followUpComplete: false,
		...overrides,
	};
}
