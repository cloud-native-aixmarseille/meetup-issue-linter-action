import type { EventDiagnostic } from "@meetup-automation/event";
import { describe, expect, it, vi } from "vitest";
import {
	EVENT_DIAGNOSTIC_COMMENT_MARKER,
	GitHubEventCommentRepository,
	type GitHubEventCommentRepositoryClient,
	GitHubEventCommentRepositoryConfigurationError,
	GitHubEventCommentRepositoryResponseError,
	GitHubEventCommentRepositoryScopeError,
	renderDiagnosticComment,
} from "../src/index.js";

const repositoryName = "cloud-native-aixmarseille/meetups";
const identity = { repository: repositoryName, issueNumber: 42 } as const;

const errorDiagnostic: EventDiagnostic = {
	code: "event.date.invalid",
	severity: "error",
	category: "invalid",
	field: "date",
	message: "An address or other private value must never be rendered",
};

function client(withMinimize = true) {
	const listComments = vi.fn();
	const createComment = vi.fn();
	const updateComment = vi.fn();
	const minimizeComment = vi.fn();
	const value = {
		rest: {
			issues: { listComments, createComment, updateComment },
		},
		...(withMinimize ? { minimizeComment } : {}),
	} as GitHubEventCommentRepositoryClient;
	return { value, listComments, createComment, updateComment, minimizeComment };
}

function adapter(
	github: GitHubEventCommentRepositoryClient,
	authorLogin?: string,
) {
	return new GitHubEventCommentRepository(github, {
		owner: "cloud-native-aixmarseille",
		repo: "meetups",
		authorLogin,
	});
}

function comment(id: number, body: string, login = "meetup-bot") {
	return { id, body, user: { login } };
}

describe("renderDiagnosticComment", () => {
	it("renders deterministic diagnostic codes without messages or values", () => {
		const body = renderDiagnosticComment([
			{
				...errorDiagnostic,
				code: "alice@example.com",
				message: "alice@example.com lives at 1 Private Street",
			},
			{ ...errorDiagnostic, severity: "warning", code: "event.hoster.missing" },
			{ ...errorDiagnostic, code: "event.date.invalid" },
			{ ...errorDiagnostic, code: "event.date.invalid" },
		]);

		expect(body).toContain(EVENT_DIAGNOSTIC_COMMENT_MARKER);
		expect(body).toContain("`event.date.invalid`");
		expect(body).toContain("`event.hoster.missing`");
		expect(body).toContain("`diagnostic.redacted`");
		expect(body).not.toContain("alice@example.com");
		expect(body).not.toContain("Private Street");
		expect(body.match(/event\.date\.invalid/g)).toHaveLength(1);
		expect(body.indexOf("**error**")).toBeLessThan(body.indexOf("**warning**"));
	});

	it("treats informational diagnostics as resolved", () => {
		const body = renderDiagnosticComment([
			{ ...errorDiagnostic, severity: "info", code: "event.date.normalized" },
		]);

		expect(body).toContain("no active diagnostics");
		expect(body).not.toContain("event.date.normalized");
	});
});

describe("GitHubEventCommentRepository", () => {
	it("creates one managed comment when actionable diagnostics appear", async () => {
		const github = client();
		github.listComments.mockResolvedValue({ data: [], headers: { link: "" } });
		github.createComment.mockResolvedValue({ data: {} });

		const result = await adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		expect(result).toEqual({ changed: true });
		expect(github.createComment).toHaveBeenCalledOnce();
		expect(github.createComment).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: "cloud-native-aixmarseille",
				repo: "meetups",
				issue_number: 42,
				body: expect.stringContaining("`event.date.invalid`"),
			}),
		);
	});

	it("does nothing when no managed comment or actionable diagnostic exists", async () => {
		const github = client();
		github.listComments.mockResolvedValue({ data: [] });

		await expect(
			adapter(github.value).reconcileDiagnostics(identity, []),
		).resolves.toEqual({ changed: false });
		expect(github.createComment).not.toHaveBeenCalled();
		expect(github.updateComment).not.toHaveBeenCalled();
	});

	it("does not update a canonical comment whose content is unchanged", async () => {
		const github = client();
		const body = renderDiagnosticComment([errorDiagnostic]);
		github.listComments.mockResolvedValue({ data: [comment(5, body)] });

		await expect(
			adapter(github.value).reconcileDiagnostics(identity, [errorDiagnostic]),
		).resolves.toEqual({ changed: false });
		expect(github.updateComment).not.toHaveBeenCalled();
	});

	it("updates changed diagnostics and minimizes stale diagnostics", async () => {
		const github = client();
		github.listComments.mockResolvedValueOnce({
			data: [
				comment(5, `${EVENT_DIAGNOSTIC_COMMENT_MARKER}\n\nOld diagnostics`),
			],
		});
		github.updateComment.mockResolvedValue({ data: {} });

		await adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);
		expect(github.updateComment).toHaveBeenLastCalledWith(
			expect.objectContaining({
				comment_id: 5,
				body: expect.stringContaining("`event.date.invalid`"),
			}),
		);

		github.listComments.mockResolvedValueOnce({
			data: [comment(5, renderDiagnosticComment([errorDiagnostic]))],
		});
		await adapter(github.value).reconcileDiagnostics(identity, []);
		expect(github.updateComment).toHaveBeenLastCalledWith(
			expect.objectContaining({
				comment_id: 5,
				body: expect.stringContaining("no active diagnostics"),
			}),
		);
	});

	it("paginates and deterministically tombstones duplicate managed comments", async () => {
		const github = client();
		const body = renderDiagnosticComment([errorDiagnostic]);
		github.listComments
			.mockResolvedValueOnce({
				data: [comment(9, body), comment(3, body)],
				headers: {
					link: '<https://api.github.test/comments?page=2>; rel="next"',
				},
			})
			.mockResolvedValueOnce({
				data: [comment(7, body), comment(4, "Unmanaged")],
				headers: { link: "" },
			});
		github.updateComment.mockResolvedValue({ data: {} });
		github.minimizeComment.mockResolvedValue({});

		const result = await adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		expect(result).toEqual({ changed: true });
		expect(github.listComments).toHaveBeenCalledTimes(2);
		expect(
			github.updateComment.mock.calls.map(([input]) => input.comment_id),
		).toEqual([7, 9]);
		expect(
			github.updateComment.mock.calls.every(([input]) =>
				input.body.includes("Superseded duplicate"),
			),
		).toBe(true);
		expect(
			github.minimizeComment.mock.calls.map(([input]) => input.commentId),
		).toEqual([7, 9]);
	});

	it("uses the configured author to avoid taking over another user's marker", async () => {
		const github = client(false);
		github.listComments.mockResolvedValue({
			data: [
				comment(
					2,
					`${EVENT_DIAGNOSTIC_COMMENT_MARKER}\nNot ours`,
					"another-user",
				),
			],
		});
		github.createComment.mockResolvedValue({ data: {} });

		await adapter(github.value, "meetup-bot").reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		expect(github.updateComment).not.toHaveBeenCalled();
		expect(github.createComment).toHaveBeenCalledOnce();
	});

	it("rejects malformed responses, invalid configuration, and wrong scope", async () => {
		const github = client();
		github.listComments.mockResolvedValue({ data: "not-an-array" });

		await expect(
			adapter(github.value).reconcileDiagnostics(identity, [errorDiagnostic]),
		).rejects.toBeInstanceOf(GitHubEventCommentRepositoryResponseError);
		await expect(
			adapter(github.value).reconcileDiagnostics(
				{ repository: "someone/else", issueNumber: 42 },
				[errorDiagnostic],
			),
		).rejects.toBeInstanceOf(GitHubEventCommentRepositoryScopeError);
		expect(
			() =>
				new GitHubEventCommentRepository(github.value, {
					owner: "",
					repo: "x",
				}),
		).toThrow(GitHubEventCommentRepositoryConfigurationError);
	});
});
