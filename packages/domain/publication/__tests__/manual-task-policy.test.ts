import { describe, expect, it } from "vitest";
import {
	type PublicationEvent,
	planManualPublicationTasks,
} from "../src/index.js";

function event(overrides: Partial<PublicationEvent> = {}): PublicationEvent {
	return {
		eventId: "cloud-native-aixmarseille/meetups#42",
		title: "Cloud Native Evening",
		description: "An evening about cloud-native technology",
		date: "2026-09-30",
		timeZone: "Europe/Paris",
		occurrenceStatus: "scheduled",
		references: {},
		slidesPublished: false,
		attendanceImported: false,
		...overrides,
	};
}

describe("manual publication tasks", () => {
	it("keeps publication tasks explicit while adapters do not exist", () => {
		const tasks = planManualPublicationTasks(event());

		expect(tasks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "publish-meetup-event",
					status: "pending",
				}),
				expect.objectContaining({
					kind: "create-asset-folder",
					status: "pending",
				}),
				expect.objectContaining({
					kind: "publish-slides",
					status: "not-applicable",
				}),
			]),
		);
	});

	it("requires post-event work only after occurrence is explicitly held", () => {
		const tasks = planManualPublicationTasks(
			event({
				occurrenceStatus: "held",
				references: {
					meetup:
						"https://www.meetup.com/cloud-native-aix-marseille/events/123",
					community:
						"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/event",
					assets: "https://drive.google.com/drive/folders/folder",
				},
				slidesPublished: false,
				attendanceImported: true,
			}),
		);

		expect(tasks).toContainEqual(
			expect.objectContaining({ kind: "publish-slides", status: "pending" }),
		);
		expect(tasks).toContainEqual(
			expect.objectContaining({
				kind: "import-attendance",
				status: "completed",
			}),
		);
	});

	it("marks all tasks inapplicable when cancelled", () => {
		const tasks = planManualPublicationTasks(
			event({ occurrenceStatus: "cancelled" }),
		);

		expect(tasks).toHaveLength(5);
		expect(tasks.every((task) => task.status === "not-applicable")).toBe(true);
	});
});
