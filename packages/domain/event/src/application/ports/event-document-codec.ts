import type { EventDiagnostic } from "../../domain/diagnostic.js";
import type { MeetupEvent } from "../../domain/model.js";
import type {
	EventDocument,
	EventRepositoryPatch,
} from "./event-repository.js";

export type EventDocumentDecodeResult = Readonly<{
	event: MeetupEvent;
	diagnostics: readonly EventDiagnostic[];
}>;

export interface EventDocumentCodec {
	decode(document: EventDocument): EventDocumentDecodeResult;
	createPatch(
		document: EventDocument,
		event: MeetupEvent,
	): EventRepositoryPatch;
}
