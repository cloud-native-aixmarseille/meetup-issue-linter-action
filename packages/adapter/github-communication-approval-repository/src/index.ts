import {
	type CommunicationApprovalRepository,
	type CommunicationApprovalSaveResult,
	type CommunicationApprovalSnapshot,
	isSafeCommunicationIdentifier,
	parseCommunicationApprovalSnapshot,
} from "@meetup-automation/communication";

export const COMMUNICATION_APPROVAL_COMMENT_MARKER =
	"<!-- meetup-automation:communication-approval:v1 -->";

type GitHubRequestResult = Readonly<{
	data: unknown;
	headers?: Readonly<Record<string, unknown>>;
}>;

export interface GithubCommunicationApprovalRepositoryClient {
	readonly rest: {
		readonly issues: {
			listComments(parameters: {
				owner: string;
				repo: string;
				issue_number: number;
				page: number;
				per_page: number;
			}): Promise<GitHubRequestResult>;
			createComment(parameters: {
				owner: string;
				repo: string;
				issue_number: number;
				body: string;
			}): Promise<unknown>;
			updateComment(parameters: {
				owner: string;
				repo: string;
				comment_id: number;
				body: string;
			}): Promise<unknown>;
		};
	};
}

export interface GithubCommunicationApprovalRepositoryOptions {
	readonly owner: string;
	readonly repo: string;
	readonly issueNumber: number;
	readonly trustedAuthorLogin: string;
}

export class GithubCommunicationApprovalRepositoryConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GithubCommunicationApprovalRepositoryConfigurationError";
	}
}

export class GithubCommunicationApprovalRepositoryResponseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GithubCommunicationApprovalRepositoryResponseError";
	}
}

export class GithubCommunicationApprovalRepositoryStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GithubCommunicationApprovalRepositoryStateError";
	}
}

type ManagedComment = Readonly<{
	id: number;
	body: string;
	authorLogin?: string;
}>;

export class GithubCommunicationApprovalRepository
	implements CommunicationApprovalRepository
{
	private readonly owner: string;
	private readonly repo: string;
	private readonly issueNumber: number;
	private readonly trustedAuthorLogin: string;

	constructor(
		private readonly client: GithubCommunicationApprovalRepositoryClient,
		options: GithubCommunicationApprovalRepositoryOptions,
	) {
		this.owner = repositoryPart(options.owner, "owner");
		this.repo = repositoryPart(options.repo, "repo");
		this.issueNumber = issueNumber(options.issueNumber);
		this.trustedAuthorLogin = trustedAuthor(options.trustedAuthorLogin);
	}

	async findApproved(
		eventId: string,
	): Promise<CommunicationApprovalSnapshot | undefined> {
		const normalizedEventId = safeEventId(eventId);
		const comment = await this.findManagedComment();
		if (!comment) {
			return undefined;
		}
		const snapshot = parseComment(comment.body);
		if (snapshot.facts.eventId !== normalizedEventId) {
			throw new GithubCommunicationApprovalRepositoryStateError(
				"Managed communication approval belongs to another event",
			);
		}
		return snapshot;
	}

	async saveApproved(
		snapshot: CommunicationApprovalSnapshot,
	): Promise<CommunicationApprovalSaveResult> {
		const canonical = strictSnapshot(snapshot);
		const desiredBody = renderComment(canonical);
		const comment = await this.findManagedComment();
		if (!comment) {
			await this.client.rest.issues.createComment({
				owner: this.owner,
				repo: this.repo,
				issue_number: this.issueNumber,
				body: desiredBody,
			});
			return Object.freeze({ changed: true });
		}

		const existing = parseComment(comment.body);
		if (existing.facts.eventId !== canonical.facts.eventId) {
			throw new GithubCommunicationApprovalRepositoryStateError(
				"Managed communication approval belongs to another event",
			);
		}
		if (comment.body === desiredBody) {
			return Object.freeze({ changed: false });
		}

		await this.client.rest.issues.updateComment({
			owner: this.owner,
			repo: this.repo,
			comment_id: comment.id,
			body: desiredBody,
		});
		return Object.freeze({ changed: true });
	}

	private async findManagedComment(): Promise<ManagedComment | undefined> {
		const matching = (await this.listComments()).filter(
			(comment) =>
				comment.body.startsWith(COMMUNICATION_APPROVAL_COMMENT_MARKER) &&
				comment.authorLogin?.toLowerCase() ===
					this.trustedAuthorLogin.toLowerCase(),
		);
		if (matching.length > 1) {
			throw new GithubCommunicationApprovalRepositoryStateError(
				"Multiple trusted communication approval comments found",
			);
		}
		return matching[0];
	}

	private async listComments(): Promise<readonly ManagedComment[]> {
		const comments: ManagedComment[] = [];
		let page = 1;
		while (true) {
			const response = await this.client.rest.issues.listComments({
				owner: this.owner,
				repo: this.repo,
				issue_number: this.issueNumber,
				page,
				per_page: 100,
			});
			if (!Array.isArray(response.data)) {
				throw new GithubCommunicationApprovalRepositoryResponseError(
					"GitHub comment list response must contain an array",
				);
			}
			for (const value of response.data) {
				const comment = mapComment(value);
				if (comment) {
					comments.push(comment);
				}
			}

			const link = header(response.headers, "link");
			const hasNext =
				link === undefined
					? response.data.length === 100
					: /<[^>]+>;\s*rel="next"/.test(link);
			if (!hasNext) {
				return comments;
			}
			page += 1;
		}
	}
}

function parseComment(body: string): CommunicationApprovalSnapshot {
	try {
		const match = body.match(/```json\s*([\s\S]*?)\s*```/);
		if (!match?.[1]) {
			throw new Error("missing JSON block");
		}
		const snapshot = parseCommunicationApprovalSnapshot(JSON.parse(match[1]));
		if (body !== renderComment(snapshot)) {
			throw new Error("non-canonical managed comment");
		}
		return snapshot;
	} catch {
		throw new GithubCommunicationApprovalRepositoryStateError(
			"Managed communication approval comment is corrupted",
		);
	}
}

function strictSnapshot(
	snapshot: CommunicationApprovalSnapshot,
): CommunicationApprovalSnapshot {
	try {
		return parseCommunicationApprovalSnapshot(snapshot);
	} catch {
		throw new GithubCommunicationApprovalRepositoryStateError(
			"Communication approval snapshot is invalid",
		);
	}
}

function renderComment(snapshot: CommunicationApprovalSnapshot): string {
	return `${COMMUNICATION_APPROVAL_COMMENT_MARKER}\n\nMaintainer-approved communication facts. Any fact change requires a new approval.\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``;
}

function mapComment(value: unknown): ManagedComment | undefined {
	if (!isRecord(value) || !Number.isSafeInteger(value.id)) {
		return undefined;
	}
	if (typeof value.body !== "string") {
		return undefined;
	}
	const authorLogin =
		isRecord(value.user) && typeof value.user.login === "string"
			? value.user.login
			: undefined;
	return {
		id: Number(value.id),
		body: value.body,
		...(authorLogin ? { authorLogin } : {}),
	};
}

function repositoryPart(value: string, name: "owner" | "repo"): string {
	const normalized = value.trim();
	if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
		throw new GithubCommunicationApprovalRepositoryConfigurationError(
			`GitHub ${name} must be a valid repository segment`,
		);
	}
	return normalized;
}

function issueNumber(value: number): number {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new GithubCommunicationApprovalRepositoryConfigurationError(
			"GitHub issue number must be a positive integer",
		);
	}
	return value;
}

function trustedAuthor(value: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new GithubCommunicationApprovalRepositoryConfigurationError(
			"A trusted GitHub bot author login is required",
		);
	}
	return normalized;
}

function safeEventId(value: string): string {
	const normalized = value.trim();
	if (!isSafeCommunicationIdentifier(normalized)) {
		throw new GithubCommunicationApprovalRepositoryConfigurationError(
			"Communication event ID must be a stable, PII-free identifier",
		);
	}
	return normalized;
}

function header(
	headers: Readonly<Record<string, unknown>> | undefined,
	name: string,
): string | undefined {
	const value = headers?.[name];
	return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
