import type {
	EventDocument,
	EventDocumentPage,
	EventIdentity,
	EventListPageQuery,
	EventRepository,
	EventRepositoryPatch,
} from "@meetup-automation/event";

type GitHubRequestResult = Readonly<{
	data: unknown;
	headers?: Readonly<Record<string, unknown>>;
}>;

/** Minimal structural client contract; no GitHub SDK DTO crosses the adapter. */
export interface GitHubEventRepositoryClient {
	readonly rest: {
		readonly issues: {
			get(parameters: {
				owner: string;
				repo: string;
				issue_number: number;
			}): Promise<GitHubRequestResult>;
			update(parameters: {
				owner: string;
				repo: string;
				issue_number: number;
				title?: string;
				body?: string;
				labels?: string[];
			}): Promise<unknown>;
			listForRepo(parameters: {
				owner: string;
				repo: string;
				state: "open" | "all";
				labels?: string;
				page: number;
				per_page: number;
			}): Promise<GitHubRequestResult>;
		};
	};
}

export type GitHubEventRepositoryOptions = Readonly<{
	owner: string;
	repo: string;
}>;

export class GitHubEventRepositoryConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubEventRepositoryConfigurationError";
	}
}

export class GitHubEventRepositoryScopeError extends Error {
	constructor(expected: string, received: string) {
		super(`GitHub event repository is scoped to ${expected}, not ${received}`);
		this.name = "GitHubEventRepositoryScopeError";
	}
}

export class GitHubEventRepositoryResponseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubEventRepositoryResponseError";
	}
}

export class GitHubEventRepository implements EventRepository {
	private readonly owner: string;
	private readonly repo: string;
	private readonly repositoryName: string;

	constructor(
		private readonly client: GitHubEventRepositoryClient,
		options: GitHubEventRepositoryOptions,
	) {
		this.owner = requireRepositoryPart(options.owner, "owner");
		this.repo = requireRepositoryPart(options.repo, "repo");
		this.repositoryName = `${this.owner}/${this.repo}`;
	}

	async find(identity: EventIdentity): Promise<EventDocument | null> {
		this.assertScope(identity.repository);

		try {
			const response = await this.client.rest.issues.get({
				owner: this.owner,
				repo: this.repo,
				issue_number: identity.issueNumber,
			});
			const document = mapGitHubIssueDocument(
				response.data,
				this.repositoryName,
			);
			if (document && document.identity.issueNumber !== identity.issueNumber) {
				throw new GitHubEventRepositoryResponseError(
					`GitHub returned issue ${document.identity.issueNumber} while ${identity.issueNumber} was requested`,
				);
			}
			return document;
		} catch (error) {
			if (isNotFoundError(error)) {
				return null;
			}
			throw error;
		}
	}

	async applyPatch(
		identity: EventIdentity,
		patch: EventRepositoryPatch,
	): Promise<void> {
		this.assertScope(identity.repository);
		const changes: {
			title?: string;
			body?: string;
			labels?: string[];
		} = {};
		if (patch.issueTitle !== undefined) {
			changes.title = patch.issueTitle;
		}
		if (patch.body !== undefined) {
			changes.body = patch.body;
		}
		if (patch.labels !== undefined) {
			changes.labels = [...patch.labels];
		}

		if (Object.keys(changes).length === 0) {
			return;
		}

		await this.client.rest.issues.update({
			owner: this.owner,
			repo: this.repo,
			issue_number: identity.issueNumber,
			...changes,
		});
	}

	async listPage(query: EventListPageQuery): Promise<EventDocumentPage> {
		this.assertScope(query.repository);
		const page = parseCursor(query.cursor);
		const pageSize = parsePageSize(query.pageSize);
		const parameters: {
			owner: string;
			repo: string;
			state: "open" | "all";
			labels?: string;
			page: number;
			per_page: number;
		} = {
			owner: this.owner,
			repo: this.repo,
			state: query.includeClosed ? "all" : "open",
			page,
			per_page: pageSize,
		};
		if (query.label !== undefined && query.label.trim() !== "") {
			parameters.labels = query.label.trim();
		}

		const response = await this.client.rest.issues.listForRepo(parameters);
		if (!Array.isArray(response.data)) {
			throw new GitHubEventRepositoryResponseError(
				"GitHub issue list response must contain an array",
			);
		}

		const items = response.data
			.map((issue) => mapGitHubIssueDocument(issue, this.repositoryName))
			.filter((issue): issue is EventDocument => issue !== null);
		const linkHeader = readHeader(response.headers, "link");
		const hasNextPage =
			linkHeader === undefined
				? response.data.length === pageSize
				: /<[^>]+>;\s*rel="next"/.test(linkHeader);

		return {
			items: Object.freeze(items),
			...(hasNextPage ? { nextCursor: String(page + 1) } : {}),
		};
	}

	private assertScope(repository: string): void {
		if (repository.toLowerCase() !== this.repositoryName.toLowerCase()) {
			throw new GitHubEventRepositoryScopeError(
				this.repositoryName,
				repository,
			);
		}
	}
}

function requireRepositoryPart(value: string, name: "owner" | "repo"): string {
	const normalized = value.trim();
	if (normalized === "" || normalized.includes("/")) {
		throw new GitHubEventRepositoryConfigurationError(
			`GitHub ${name} must be a non-empty repository name segment`,
		);
	}
	return normalized;
}

/** Map one GitHub issue response or webhook snapshot into the domain document. */
export function mapGitHubIssueDocument(
	data: unknown,
	repository: string,
): EventDocument | null {
	const issue = asRecord(data, "GitHub issue");
	if (issue.pull_request !== undefined && issue.pull_request !== null) {
		return null;
	}
	if (!Number.isInteger(issue.number) || Number(issue.number) <= 0) {
		throw new GitHubEventRepositoryResponseError(
			"GitHub issue number must be a positive integer",
		);
	}
	if (typeof issue.title !== "string") {
		throw new GitHubEventRepositoryResponseError(
			"GitHub issue title must be a string",
		);
	}
	if (issue.state !== "open" && issue.state !== "closed") {
		throw new GitHubEventRepositoryResponseError(
			"GitHub issue state must be open or closed",
		);
	}
	if (issue.body !== null && typeof issue.body !== "string") {
		throw new GitHubEventRepositoryResponseError(
			"GitHub issue body must be a string or null",
		);
	}
	if (!Array.isArray(issue.labels)) {
		throw new GitHubEventRepositoryResponseError(
			"GitHub issue labels must be an array",
		);
	}

	return {
		identity: { repository, issueNumber: Number(issue.number) },
		issueState: issue.state,
		issueTitle: issue.title,
		labels: mapLabels(issue.labels),
		body: issue.body ?? "",
	};
}

function mapLabels(labels: readonly unknown[]): readonly string[] {
	const result: string[] = [];
	for (const label of labels) {
		let name: string | undefined;
		if (typeof label === "string") {
			name = label;
		} else if (isRecord(label) && typeof label.name === "string") {
			name = label.name;
		}
		if (name && !result.includes(name)) {
			result.push(name);
		}
	}
	return Object.freeze(result);
}

function parseCursor(cursor: string | undefined): number {
	if (cursor === undefined) {
		return 1;
	}
	if (!/^[1-9]\d*$/.test(cursor)) {
		throw new GitHubEventRepositoryConfigurationError(
			`Invalid GitHub pagination cursor "${cursor}"`,
		);
	}
	return Number(cursor);
}

function parsePageSize(pageSize: number | undefined): number {
	if (pageSize === undefined) {
		return 100;
	}
	if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
		throw new GitHubEventRepositoryConfigurationError(
			"GitHub page size must be an integer between 1 and 100",
		);
	}
	return pageSize;
}

function isNotFoundError(error: unknown): boolean {
	if (!isRecord(error)) {
		return false;
	}
	if (error.status === 404) {
		return true;
	}
	return isRecord(error.response) && error.response.status === 404;
}

function readHeader(
	headers: Readonly<Record<string, unknown>> | undefined,
	name: string,
): string | undefined {
	const value = headers?.[name];
	return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
	if (!isRecord(value)) {
		throw new GitHubEventRepositoryResponseError(`${label} must be an object`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
