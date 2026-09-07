import type {
	EventCommentReconciliation,
	EventCommentRepository,
	EventDiagnostic,
	EventIdentity,
} from "@meetup-automation/event";

export const EVENT_DIAGNOSTIC_COMMENT_MARKER =
	"<!-- meetup-automation:event-diagnostics:v1 -->";

const DUPLICATE_COMMENT_MARKER =
	"<!-- meetup-automation:event-diagnostics-duplicate:v1 -->";
const RESOLVED_COMMENT_BODY = `${EVENT_DIAGNOSTIC_COMMENT_MARKER}\n\nMeetup automation found no active diagnostics.`;
const DUPLICATE_COMMENT_BODY = `${DUPLICATE_COMMENT_MARKER}\n\nSuperseded duplicate automation comment.`;

type GitHubRequestResult = Readonly<{
	data: unknown;
	headers?: Readonly<Record<string, unknown>>;
}>;

/** Minimal structural client contract; comment SDK DTOs stay inside the adapter. */
export interface GitHubEventCommentRepositoryClient {
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
	readonly minimizeComment?: (parameters: {
		commentId: number;
		classifier: "OUTDATED";
	}) => Promise<unknown>;
}

export type GitHubEventCommentRepositoryOptions = Readonly<{
	owner: string;
	repo: string;
	/** Restrict managed comments to this bot login when it is known. */
	authorLogin?: string;
}>;

export class GitHubEventCommentRepositoryConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubEventCommentRepositoryConfigurationError";
	}
}

export class GitHubEventCommentRepositoryResponseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubEventCommentRepositoryResponseError";
	}
}

export class GitHubEventCommentRepositoryScopeError extends Error {
	constructor(expected: string, received: string) {
		super(
			`GitHub event comment repository is scoped to ${expected}, not ${received}`,
		);
		this.name = "GitHubEventCommentRepositoryScopeError";
	}
}

type ManagedComment = Readonly<{
	id: number;
	body: string;
	authorLogin?: string;
}>;

export class GitHubEventCommentRepository implements EventCommentRepository {
	private readonly owner: string;
	private readonly repo: string;
	private readonly repositoryName: string;
	private readonly authorLogin: string | undefined;

	constructor(
		private readonly client: GitHubEventCommentRepositoryClient,
		options: GitHubEventCommentRepositoryOptions,
	) {
		this.owner = requireRepositoryPart(options.owner, "owner");
		this.repo = requireRepositoryPart(options.repo, "repo");
		this.repositoryName = `${this.owner}/${this.repo}`;
		this.authorLogin = options.authorLogin?.trim() || undefined;
	}

	async reconcileDiagnostics(
		identity: EventIdentity,
		diagnostics: readonly EventDiagnostic[],
	): Promise<EventCommentReconciliation> {
		this.assertScope(identity.repository);
		const managedComments = await this.listManagedComments(
			identity.issueNumber,
		);
		const [canonical, ...duplicates] = managedComments;
		let changed = await this.minimizeDuplicates(duplicates);
		const body = renderDiagnosticComment(diagnostics);

		if (!canonical) {
			if (body === RESOLVED_COMMENT_BODY) {
				return { changed };
			}
			await this.client.rest.issues.createComment({
				owner: this.owner,
				repo: this.repo,
				issue_number: identity.issueNumber,
				body,
			});
			return { changed: true };
		}

		if (canonical.body !== body) {
			await this.updateComment(canonical.id, body);
			changed = true;
		}

		return { changed };
	}

	private async listManagedComments(
		issueNumber: number,
	): Promise<readonly ManagedComment[]> {
		const comments: ManagedComment[] = [];
		let page = 1;
		let hasNextPage = true;

		while (hasNextPage) {
			const response = await this.client.rest.issues.listComments({
				owner: this.owner,
				repo: this.repo,
				issue_number: issueNumber,
				page,
				per_page: 100,
			});
			if (!Array.isArray(response.data)) {
				throw new GitHubEventCommentRepositoryResponseError(
					"GitHub comment list response must contain an array",
				);
			}

			for (const rawComment of response.data) {
				const comment = mapComment(rawComment);
				if (comment && this.isManagedComment(comment)) {
					comments.push(comment);
				}
			}

			const linkHeader = readHeader(response.headers, "link");
			hasNextPage =
				linkHeader === undefined
					? response.data.length === 100
					: /<[^>]+>;\s*rel="next"/.test(linkHeader);
			page += 1;
		}

		return comments.sort((left, right) => left.id - right.id);
	}

	private isManagedComment(comment: ManagedComment): boolean {
		if (!comment.body.startsWith(EVENT_DIAGNOSTIC_COMMENT_MARKER)) {
			return false;
		}
		return (
			this.authorLogin === undefined ||
			comment.authorLogin?.toLowerCase() === this.authorLogin.toLowerCase()
		);
	}

	private async minimizeDuplicates(
		duplicates: readonly ManagedComment[],
	): Promise<boolean> {
		for (const duplicate of duplicates) {
			await this.updateComment(duplicate.id, DUPLICATE_COMMENT_BODY);
			if (this.client.minimizeComment) {
				await this.client.minimizeComment({
					commentId: duplicate.id,
					classifier: "OUTDATED",
				});
			}
		}
		return duplicates.length > 0;
	}

	private async updateComment(commentId: number, body: string): Promise<void> {
		await this.client.rest.issues.updateComment({
			owner: this.owner,
			repo: this.repo,
			comment_id: commentId,
			body,
		});
	}

	private assertScope(repository: string): void {
		if (repository.toLowerCase() !== this.repositoryName.toLowerCase()) {
			throw new GitHubEventCommentRepositoryScopeError(
				this.repositoryName,
				repository,
			);
		}
	}
}

export function renderDiagnosticComment(
	diagnostics: readonly EventDiagnostic[],
): string {
	const actionable = new Set<string>();
	for (const item of diagnostics) {
		if (item.severity === "info") {
			continue;
		}
		const code = /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(item.code)
			? item.code
			: "diagnostic.redacted";
		actionable.add(`${item.severity}:${code}`);
	}

	if (actionable.size === 0) {
		return RESOLVED_COMMENT_BODY;
	}

	const lines = [...actionable].sort(compareDiagnosticLines).map((entry) => {
		const separator = entry.indexOf(":");
		const severity = entry.slice(0, separator);
		const code = entry.slice(separator + 1);
		return `- **${severity}** \`${code}\``;
	});

	return [
		EVENT_DIAGNOSTIC_COMMENT_MARKER,
		"",
		"### Meetup automation diagnostics",
		"",
		...lines,
		"",
		"Messages and event/contact values are intentionally omitted from this comment.",
	].join("\n");
}

function compareDiagnosticLines(left: string, right: string): number {
	const severityOrder = (value: string): number =>
		value.startsWith("error:") ? 0 : 1;
	return (
		severityOrder(left) - severityOrder(right) || left.localeCompare(right)
	);
}

function mapComment(data: unknown): ManagedComment | null {
	if (!isRecord(data)) {
		throw new GitHubEventCommentRepositoryResponseError(
			"GitHub comment must be an object",
		);
	}
	if (!Number.isInteger(data.id) || Number(data.id) <= 0) {
		throw new GitHubEventCommentRepositoryResponseError(
			"GitHub comment identifier must be a positive integer",
		);
	}
	if (data.body === null) {
		return null;
	}
	if (typeof data.body !== "string") {
		throw new GitHubEventCommentRepositoryResponseError(
			"GitHub comment body must be a string or null",
		);
	}

	const user = isRecord(data.user) ? data.user : undefined;
	return {
		id: Number(data.id),
		body: data.body,
		authorLogin: typeof user?.login === "string" ? user.login : undefined,
	};
}

function requireRepositoryPart(value: string, name: "owner" | "repo"): string {
	const normalized = value.trim();
	if (normalized === "" || normalized.includes("/")) {
		throw new GitHubEventCommentRepositoryConfigurationError(
			`GitHub ${name} must be a non-empty repository name segment`,
		);
	}
	return normalized;
}

function readHeader(
	headers: Readonly<Record<string, unknown>> | undefined,
	name: string,
): string | undefined {
	const value = headers?.[name];
	return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
