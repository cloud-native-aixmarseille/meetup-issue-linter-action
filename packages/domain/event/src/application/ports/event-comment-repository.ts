import type { EventDiagnostic } from "../../domain/diagnostic.js";
import type { EventIdentity } from "../../domain/model.js";

export type EventCommentReconciliation = Readonly<{
	changed: boolean;
}>;

export interface EventCommentRepository {
	reconcileDiagnostics(
		identity: EventIdentity,
		diagnostics: readonly EventDiagnostic[],
	): Promise<EventCommentReconciliation>;
}
