import { type MeetupEvent, postEventChecklistIsComplete } from "./model.js";

export type EventPatchPath =
	| "issueTitle"
	| "labels"
	| "eventTitle"
	| "date"
	| "description"
	| "host"
	| "agenda"
	| "publicationLinks"
	| "occurrenceStatus"
	| "timeZone"
	| "confirmations"
	| "logistics"
	| "operationalChecklists"
	| "followUpComplete";

export type EventPatchOperation = {
	[P in EventPatchPath]: Readonly<{
		op: "replace";
		path: P;
		value: MeetupEvent[P];
		reason: string;
	}>;
}[EventPatchPath];

export type EventPatch = Readonly<{
	operations: readonly EventPatchOperation[];
}>;

export const EMPTY_EVENT_PATCH: EventPatch = Object.freeze({ operations: [] });

export function replaceEventField<P extends EventPatchPath>(
	path: P,
	value: MeetupEvent[P],
	reason: string,
): Extract<EventPatchOperation, { path: P }> {
	return Object.freeze({
		op: "replace" as const,
		path,
		value,
		reason,
	}) as unknown as Extract<EventPatchOperation, { path: P }>;
}

export function createEventPatch(
	operations: readonly EventPatchOperation[],
): EventPatch {
	return Object.freeze({ operations: Object.freeze([...operations]) });
}

export function mergeEventPatches(
	...patches: readonly EventPatch[]
): EventPatch {
	return createEventPatch(patches.flatMap((patch) => patch.operations));
}

export function applyEventPatch(
	event: MeetupEvent,
	patch: EventPatch,
): MeetupEvent {
	return patch.operations.reduce<MeetupEvent>(
		(current, operation) => applyOperation(current, operation),
		event,
	);
}

function applyOperation(
	event: MeetupEvent,
	operation: EventPatchOperation,
): MeetupEvent {
	switch (operation.path) {
		case "issueTitle":
			return { ...event, issueTitle: operation.value };
		case "labels":
			return { ...event, labels: [...operation.value] };
		case "eventTitle":
			return { ...event, eventTitle: operation.value };
		case "date":
			return { ...event, date: operation.value };
		case "description":
			return { ...event, description: operation.value };
		case "host":
			return {
				...event,
				host: operation.value ? { ...operation.value } : undefined,
			};
		case "agenda":
			return {
				...event,
				agenda: operation.value.map((entry) => ({
					...entry,
					speakers: entry.speakers.map((speaker) => ({ ...speaker })),
				})),
			};
		case "publicationLinks":
			return { ...event, publicationLinks: { ...operation.value } };
		case "occurrenceStatus":
			return { ...event, occurrenceStatus: operation.value };
		case "timeZone":
			return { ...event, timeZone: operation.value };
		case "confirmations":
			return { ...event, confirmations: { ...operation.value } };
		case "logistics":
			return { ...event, logistics: { ...operation.value } };
		case "operationalChecklists": {
			const operationalChecklists = {
				slidesAndContent: operation.value.slidesAndContent.map((item) => ({
					...item,
				})),
				communication: operation.value.communication.map((item) => ({
					...item,
				})),
				postEvent: operation.value.postEvent.map((item) => ({ ...item })),
			};
			return {
				...event,
				operationalChecklists,
				followUpComplete:
					event.followUpComplete &&
					postEventChecklistIsComplete(operationalChecklists.postEvent),
			};
		}
		case "followUpComplete":
			return {
				...event,
				followUpComplete:
					operation.value &&
					postEventChecklistIsComplete(event.operationalChecklists.postEvent),
			};
	}
}
