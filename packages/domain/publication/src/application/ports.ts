import type { PublicationEvent } from "../domain/model.js";

export type PublishedEventReference = Readonly<{
	id: string;
	url: string;
}>;

export type PublishEventRequest = Readonly<{
	event: PublicationEvent;
	idempotencyKey: string;
}>;

export interface EventPublisher {
	publish(request: PublishEventRequest): Promise<PublishedEventReference>;
}

export interface CommunityEventPublisher {
	publish(request: PublishEventRequest): Promise<PublishedEventReference>;
}

export type AssetContainer = Readonly<{
	id: string;
	url: string;
}>;

export type EnsureAssetContainerRequest = Readonly<{
	eventId: string;
	title: string;
	idempotencyKey: string;
}>;

export interface AssetRepository {
	ensureContainer(
		request: EnsureAssetContainerRequest,
	): Promise<AssetContainer>;
}

export type AttendanceRecord = Readonly<{
	participantId?: string;
	displayName: string;
	present: boolean;
}>;

export type ImportAttendanceRequest = Readonly<{
	eventId: string;
	idempotencyKey: string;
}>;

export interface AttendanceGateway {
	importAttendance(
		request: ImportAttendanceRequest,
	): Promise<readonly AttendanceRecord[]>;
}
