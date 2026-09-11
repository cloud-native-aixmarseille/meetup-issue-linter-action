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
	name: string;
	eventId: string;
}>;

export type EnsureAssetContainerRequest = Readonly<{
	eventId: string;
	title: string;
	idempotencyKey: string;
}>;

export type AssetTemplate = Readonly<{
	id: string;
	name: string;
	kind: string;
}>;

export type AssetFile = Readonly<{
	id: string;
	name: string;
	url?: string;
	templateId?: string;
	kind?: string;
}>;

export interface AssetRepository {
	findContainer(
		request: EnsureAssetContainerRequest,
	): Promise<AssetContainer | undefined>;
	ensureContainer(
		request: EnsureAssetContainerRequest,
	): Promise<AssetContainer>;
	listTemplates(): Promise<readonly AssetTemplate[]>;
	listFiles(containerId: string): Promise<readonly AssetFile[]>;
	copyTemplate(
		containerId: string,
		template: AssetTemplate,
		name: string,
	): Promise<AssetFile>;
	updateFile(
		file: AssetFile,
		template: AssetTemplate,
		name: string,
	): Promise<AssetFile>;
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
