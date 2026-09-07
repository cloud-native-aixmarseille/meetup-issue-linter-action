import type { PublicationEvent } from "./model.js";

export type ManualPublicationTaskKind =
	| "publish-meetup-event"
	| "publish-community-event"
	| "create-asset-folder"
	| "publish-slides"
	| "import-attendance";

export type ManualPublicationTaskStatus =
	| "pending"
	| "completed"
	| "not-applicable";

export type ManualPublicationTask = Readonly<{
	kind: ManualPublicationTaskKind;
	status: ManualPublicationTaskStatus;
	reason: string;
}>;

/** Models human work explicitly until a corresponding outbound adapter exists. */
export function planManualPublicationTasks(
	event: PublicationEvent,
): readonly ManualPublicationTask[] {
	if (event.occurrenceStatus === "cancelled") {
		return Object.freeze(
			allTaskKinds().map((kind) => ({
				kind,
				status: "not-applicable" as const,
				reason: "The event is cancelled",
			})),
		);
	}

	const occurrenceConfirmed = event.occurrenceStatus === "held";
	return Object.freeze([
		task(
			"publish-meetup-event",
			Boolean(event.references.meetup),
			"Publish the event to Meetup",
		),
		task(
			"publish-community-event",
			Boolean(event.references.community),
			"Publish the event to the CNCF community platform",
		),
		task(
			"create-asset-folder",
			Boolean(event.references.assets),
			"Create the event asset folder",
		),
		occurrenceConfirmed
			? task(
					"publish-slides",
					event.slidesPublished,
					"Publish post-event slides",
				)
			: notApplicable(
					"publish-slides",
					"Slides are published only after occurrence is explicitly confirmed",
				),
		occurrenceConfirmed
			? task(
					"import-attendance",
					event.attendanceImported,
					"Import post-event attendance",
				)
			: notApplicable(
					"import-attendance",
					"Attendance is imported only after occurrence is explicitly confirmed",
				),
	]);
}

function task(
	kind: ManualPublicationTaskKind,
	completed: boolean,
	reason: string,
): ManualPublicationTask {
	return {
		kind,
		status: completed ? "completed" : "pending",
		reason,
	};
}

function notApplicable(
	kind: ManualPublicationTaskKind,
	reason: string,
): ManualPublicationTask {
	return { kind, status: "not-applicable", reason };
}

function allTaskKinds(): readonly ManualPublicationTaskKind[] {
	return [
		"publish-meetup-event",
		"publish-community-event",
		"create-asset-folder",
		"publish-slides",
		"import-attendance",
	];
}
