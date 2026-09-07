import type { EventIdentity, IssueState } from "../../domain/model.js";

export type EventDocument = Readonly<{
	identity: EventIdentity;
	issueState: IssueState;
	issueTitle: string;
	labels: readonly string[];
	body: string;
}>;

export type EventRepositoryPatch = Readonly<{
	issueTitle?: string;
	labels?: readonly string[];
	body?: string;
}>;

export type EventListPageQuery = Readonly<{
	repository: string;
	label?: string;
	includeClosed?: boolean;
	pageSize?: number;
	cursor?: string;
}>;

export type EventDocumentPage = Readonly<{
	items: readonly EventDocument[];
	nextCursor?: string;
}>;

export interface EventRepository {
	find(identity: EventIdentity): Promise<EventDocument | null>;
	applyPatch(
		identity: EventIdentity,
		patch: EventRepositoryPatch,
	): Promise<void>;
	listPage(query: EventListPageQuery): Promise<EventDocumentPage>;
}

export function eventRepositoryPatchIsEmpty(
	patch: EventRepositoryPatch,
): boolean {
	return (
		patch.issueTitle === undefined &&
		patch.labels === undefined &&
		patch.body === undefined
	);
}
