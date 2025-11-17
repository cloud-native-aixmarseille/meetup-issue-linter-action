import { createHash } from "node:crypto";
import { auth, drive, type drive_v3 } from "@googleapis/drive";
import type {
	AssetContainer,
	AssetFile,
	AssetRepository,
	AssetTemplate,
	EnsureAssetContainerRequest,
} from "@meetup-automation/publication";

type DriveFile = drive_v3.Schema$File;
export type GoogleDriveClient = Pick<drive_v3.Drive, "files">;
export type GoogleDriveAssetOptions = Readonly<{
	parentFolderId: string;
	templateFolderId: string;
}>;
const folderMimeType = "application/vnd.google-apps.folder";
const fields = "id,name,webViewLink,mimeType,parents,trashed,appProperties";
// A workflow retry first looks up stable metadata. Do not automatically replay a
// create/copy after a lost response: the first request may already have succeeded.
const requestOptions = { retry: false, timeout: 30_000 };

export class GoogleDriveAssetRepositoryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GoogleDriveAssetRepositoryError";
	}
}

export function createGoogleDriveAssetRepository(
	credentialsJson: string,
	options: GoogleDriveAssetOptions,
): GoogleDriveAssetRepository {
	let credentials: {
		type?: unknown;
		client_email?: unknown;
		private_key?: unknown;
	};
	try {
		credentials = JSON.parse(credentialsJson);
	} catch {
		throw failure("Invalid Google service-account credentials");
	}
	if (
		credentials?.type !== "service_account" ||
		typeof credentials.client_email !== "string" ||
		!credentials.client_email ||
		typeof credentials.private_key !== "string" ||
		!credentials.private_key
	) {
		throw failure("Invalid Google service-account credentials");
	}
	// Only the expected service-account fields cross the boundary. Arbitrary
	// credential configurations cannot select an external token endpoint.
	const authentication = new auth.JWT({
		email: credentials.client_email,
		key: credentials.private_key,
		scopes: ["https://www.googleapis.com/auth/drive"],
	});
	return new GoogleDriveAssetRepository(
		drive({ version: "v3", auth: authentication }),
		options,
	);
}

export class GoogleDriveAssetRepository implements AssetRepository {
	constructor(
		private readonly client: GoogleDriveClient,
		private readonly options: GoogleDriveAssetOptions,
	) {
		if (
			![options.parentFolderId, options.templateFolderId].every((id) =>
				/^[\w-]+$/.test(id),
			) ||
			options.parentFolderId === options.templateFolderId
		)
			throw failure(
				"Distinct Google Drive parent and template folder IDs are required",
			);
	}

	async findContainer(
		request: EnsureAssetContainerRequest,
	): Promise<AssetContainer | undefined> {
		const matches = await this.list(
			`'${escapeQuery(this.options.parentFolderId)}' in parents and mimeType='${folderMimeType}' and appProperties has { key='meetup_event_key' and value='${key(request)}' }`,
		);
		if (matches.length > 1)
			throw failure(
				"Multiple asset folders match this event; manual reconciliation is required",
			);
		let file = matches[0];
		if (!file && request.existingUrl) {
			const id =
				/^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)\/?$/.exec(
					request.existingUrl,
				)?.[1];
			if (id)
				file = await remote(() =>
					this.client.files.get(
						{ fileId: id, fields, supportsAllDrives: true },
						requestOptions,
					),
				).then(({ data }) => data);
		}
		if (!file) return undefined;
		const properties = file.appProperties ?? {};
		if (
			file.trashed ||
			file.mimeType !== folderMimeType ||
			!file.parents?.includes(this.options.parentFolderId) ||
			(properties.meetup_event_key &&
				properties.meetup_event_key !== key(request)) ||
			(properties.issue_number &&
				properties.issue_number !== request.legacyEventId)
		) {
			throw failure(
				"The linked asset folder is outside the configured parent or belongs to another event",
			);
		}
		return container(
			file,
			properties.meetup_event_key === key(request)
				? request.eventId
				: undefined,
		);
	}

	async ensureContainer(
		request: EnsureAssetContainerRequest,
	): Promise<AssetContainer> {
		const current = await this.findContainer(request);
		if (current?.name === request.title && current.eventId === request.eventId)
			return current;
		const appProperties = {
			meetup_event_key: key(request),
			issue_number: request.legacyEventId,
		};
		const response = current
			? await remote(() =>
					this.client.files.update(
						{
							fileId: current.id,
							requestBody: { name: request.title, appProperties },
							fields,
							supportsAllDrives: true,
						},
						requestOptions,
					),
				)
			: await remote(() =>
					this.client.files.create(
						{
							requestBody: {
								name: request.title,
								mimeType: folderMimeType,
								parents: [this.options.parentFolderId],
								appProperties,
							},
							fields,
							supportsAllDrives: true,
						},
						requestOptions,
					),
				);
		return container(response.data, request.eventId);
	}

	async listTemplates(): Promise<readonly AssetTemplate[]> {
		return (
			await this.list(
				`'${escapeQuery(this.options.templateFolderId)}' in parents`,
			)
		).map((file) => {
			if (
				!file.id ||
				!file.name ||
				!file.appProperties?.template_kind ||
				file.mimeType === folderMimeType
			)
				throw failure(
					"Every asset template must be a file with an ID, name, and template_kind",
				);
			return {
				id: file.id,
				name: file.name,
				kind: file.appProperties.template_kind,
			};
		});
	}

	async listFiles(containerId: string): Promise<readonly AssetFile[]> {
		return (
			await this.list(
				`'${escapeQuery(containerId)}' in parents and mimeType!='${folderMimeType}'`,
			)
		).map(assetFile);
	}

	async copyTemplate(
		containerId: string,
		template: AssetTemplate,
		name: string,
	): Promise<AssetFile> {
		const { data } = await remote(() =>
			this.client.files.copy(
				{
					fileId: template.id,
					requestBody: {
						name,
						parents: [containerId],
						appProperties: templateProperties(template),
					},
					fields,
					supportsAllDrives: true,
				},
				requestOptions,
			),
		);
		return assetFile(data);
	}

	async updateFile(
		file: AssetFile,
		template: AssetTemplate,
		name: string,
	): Promise<AssetFile> {
		const { data } = await remote(() =>
			this.client.files.update(
				{
					fileId: file.id,
					requestBody: { name, appProperties: templateProperties(template) },
					fields,
					supportsAllDrives: true,
				},
				requestOptions,
			),
		);
		return assetFile(data);
	}

	private async list(query: string): Promise<DriveFile[]> {
		const files: DriveFile[] = [];
		let pageToken: string | undefined;
		const tokens = new Set<string>();
		do {
			const { data } = await remote(() =>
				this.client.files.list(
					{
						q: `${query} and trashed=false`,
						fields: `nextPageToken,incompleteSearch,files(${fields})`,
						pageSize: 100,
						pageToken,
						supportsAllDrives: true,
						includeItemsFromAllDrives: true,
					},
					requestOptions,
				),
			);
			if (data.incompleteSearch)
				throw failure(
					"Google Drive returned an incomplete search; reconciliation was stopped",
				);
			files.push(...(data.files ?? []));
			pageToken = data.nextPageToken || undefined;
			if (pageToken && tokens.has(pageToken))
				throw failure("Google Drive returned a repeated pagination token");
			if (pageToken) tokens.add(pageToken);
		} while (pageToken);
		return files;
	}
}

function key(request: EnsureAssetContainerRequest): string {
	return createHash("sha256").update(request.idempotencyKey).digest("hex");
}
function escapeQuery(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
function templateProperties(template: AssetTemplate): Record<string, string> {
	return { template_file_id: template.id, template_kind: template.kind };
}
function container(file: DriveFile, eventId?: string): AssetContainer {
	if (!file.id || !file.name)
		throw failure("Google Drive returned an invalid asset folder");
	return {
		id: file.id,
		name: file.name,
		url: `https://drive.google.com/drive/folders/${file.id}`,
		eventId,
	};
}
function assetFile(file: DriveFile): AssetFile {
	if (!file.id || !file.name)
		throw failure("Google Drive returned an invalid asset file");
	return {
		id: file.id,
		name: file.name,
		...(file.webViewLink ? { url: file.webViewLink } : {}),
		templateId: file.appProperties?.template_file_id,
		kind: file.appProperties?.template_kind,
	};
}
function failure(message: string): GoogleDriveAssetRepositoryError {
	return new GoogleDriveAssetRepositoryError(message);
}
async function remote<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		const status = (error as { response?: { status?: number } } | null)
			?.response?.status;
		if (status === 429)
			throw failure(
				"Google Drive rate limit reached; retry reconciliation later",
			);
		if (status === 401 || status === 403)
			throw failure(
				"Google Drive denied access; check credentials, folder access, and quota",
			);
		throw failure(
			"Google Drive request failed; inspect provider state before retrying an uncertain write",
		);
	}
}
