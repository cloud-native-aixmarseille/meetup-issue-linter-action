import type { EventDiagnostic } from "@meetup-automation/event";
import { describe, expect, it, vi } from "vitest";
import { GitHubEventCommentRepository } from "./github-event-comment-repository.js";
import { GitHubEventCommentRepositoryConfigurationError } from "./github-event-comment-repository-configuration-error.js";
import {
	EVENT_DIAGNOSTIC_COMMENT_MARKER,
	type GitHubEventCommentRepositoryClient,
} from "./github-event-comment-repository-contracts.js";
import { GitHubEventCommentRepositoryResponseError } from "./github-event-comment-repository-response-error.js";
import { GitHubEventCommentRepositoryScopeError } from "./github-event-comment-repository-scope-error.js";
import { EventCommentMessages } from "./i18n/event-comment-messages.js";

const repositoryName = "example/meetups";

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
		owner: "example",
		repo: "meetups",
		authorLogin,
	});
}

function comment(id: number, body: string, login = "meetup-bot") {
	return { id, body, user: { login } };
}

describe("renderDiagnosticComment", () => {
	it.each([
		["en", "Enter a valid HTTPS link to the OpenFeedback event page."],
		[
			"fr",
			"Saisissez un lien HTTPS valide vers la page de l'événement OpenFeedback.", // codespell:ignore valide
		],
	])(
		"renders feedback URL guidance in %s without exposing its value",
		(locale, guidance) => {
			// Arrange
			const messages = new EventCommentMessages(locale);
			const diagnostics = [
				{
					...errorDiagnostic,
					code: "event.link.feedback.invalid",
					field: "publicationLinks.feedback",
				},
			];

			// Act
			const body = GitHubEventCommentRepository.renderDiagnosticComment(
				diagnostics,
				messages,
			);

			// Assert
			expect(body).toContain(`**OpenFeedback Link**: ${guidance}`);
			expect(body).not.toContain(errorDiagnostic.message);
		},
	);

	it("localizes guidance while retaining markers, issue headings and privacy boundaries", () => {
		// Arrange
		const messages = new EventCommentMessages("fr");
		const diagnostics = [
			errorDiagnostic,
			{
				...errorDiagnostic,
				code: "unrecognized.code",
				field: "private@example.test",
			},
			{
				...errorDiagnostic,
				code: "event.agenda.speaker.missing",
				field: "agenda.0.speakers.1",
			},
		];
		// Act
		const body = GitHubEventCommentRepository.renderDiagnosticComment(
			diagnostics,
			messages,
		);
		const resolved = GitHubEventCommentRepository.renderDiagnosticComment(
			[],
			messages,
		);
		// Assert
		expect(body).toContain(EVENT_DIAGNOSTIC_COMMENT_MARKER);
		expect(body).toContain("**Event Date**: Saisissez une date valide"); // codespell:ignore valide
		expect(body).toContain("**Programme (élément 1, intervenant 2)**");
		expect(body).toContain("Une vérification supplémentaire");
		expect(body).not.toContain("private@example.test");
		expect(body).not.toContain(errorDiagnostic.message);
		expect(resolved).toContain(EVENT_DIAGNOSTIC_COMMENT_MARKER);
		expect(resolved).toContain(
			"Tous les problèmes signalés précédemment ont été résolus.",
		);
	});

	it("renders incomplete event fields as an actionable checklist in form order", () => {
		// Arrange
		const diagnostics = [
			"event.confirmation.speakers.missing",
			"event.description.missing",
			"event.title.missing",
			"publication.assets.missing",
			"publication.community.missing",
			"publication.meetup.missing",
		].map(
			(code): EventDiagnostic => ({
				code,
				severity: "warning",
				category: "incomplete",
				message: "Internal message",
			}),
		);

		// Act
		const body =
			GitHubEventCommentRepository.renderDiagnosticComment(diagnostics);
		const actual = GitHubEventCommentRepository.renderDiagnosticComment(
			[...diagnostics].reverse(),
		);

		// Assert
		expect(body).toBe(`${EVENT_DIAGNOSTIC_COMMENT_MARKER}

Found the following items to complete in the meetup issue:

- [ ] **Event Title**: Add a title for the event.
- [ ] **Event Description**: Add a short description of the event.
- [ ] **Meetup Link**: Add the link to the Meetup event page.
- [ ] **CNCF Link**: Add the link to the CNCF / OCGroups event page.
- [ ] **Drive Link**: Add the link to the event's Google Drive folder.
- [ ] **Speaker confirmation**: Confirm the speakers, then add the \`speakers:confirmed\` label.

Please update the issue description or labels to address these items. This checklist will refresh automatically.`);
		expect(actual).toBe(body);
	});

	it("keeps separate corrections for fields and speakers sharing a diagnostic code", () => {
		// Arrange
		const logistics = {
			...errorDiagnostic,
			code: "event.logistics.intent.invalid",
		};
		const unknownSpeaker = {
			...errorDiagnostic,
			code: "referential.reference.speaker.unknown",
		};
		const diagnostics: EventDiagnostic[] = [
			{ ...logistics, field: "Restaurant / Bar" },
			{ ...logistics, field: "Aperitif" },
			{ ...logistics, field: "Aperitif" },
			{ ...unknownSpeaker, field: "speakerReferences[1]" },
			{ ...unknownSpeaker, field: "speakerReferences[0]" },
		];

		// Act
		const body =
			GitHubEventCommentRepository.renderDiagnosticComment(diagnostics);

		// Assert
		expect(body.match(/^- \[ \]/gm)).toHaveLength(4);
		expect(body).toContain("**Aperitif**: Choose `Yes` or `No`");
		expect(body).toContain("**Restaurant / Bar**: Choose `Yes` or `No`");
		expect(body).toContain(
			"**Agenda (speaker 1)**: This speaker was not found",
		);
		expect(body).toContain(
			"**Agenda (speaker 2)**: This speaker was not found",
		);
		expect(body).toContain("including accents");
		expect(body).toContain("Speaker name [speaker-0001]");
	});

	it("locates malformed agenda entries and missing or duplicated form sections", () => {
		// Arrange
		const diagnostics: EventDiagnostic[] = [
			{
				...errorDiagnostic,
				code: "event.agenda.description.missing",
				field: "agenda.1.description",
			},
			{
				...errorDiagnostic,
				code: "event.agenda.speaker.invalid",
				field: "agenda.0.speakers.1",
			},
			{
				...errorDiagnostic,
				code: "event.document.heading.missing",
				field: "Event Title",
			},
			{
				...errorDiagnostic,
				code: "event.document.heading.duplicate",
				field: "Hoster",
			},
			{
				...errorDiagnostic,
				code: "event.document.checkbox.invalid",
				field: "Post event",
			},
		];

		// Act
		const body =
			GitHubEventCommentRepository.renderDiagnosticComment(diagnostics);

		// Assert
		expect(body).toContain("**Event Title**: Restore this section heading");
		expect(body).toContain("**Hoster**: Keep a single section");
		expect(body).toContain(
			"**Agenda (item 1, speaker 2)**: Enter a speaker name",
		);
		expect(body).toContain("**Agenda (item 2)**: Add a talk description");
		expect(body).toContain("**Post event**: Use `- [ ] Task`");
	});

	it("never copies raw messages, arbitrary fields, or diagnostic codes into comments", () => {
		// Arrange
		const diagnostics: EventDiagnostic[] = [
			{
				...errorDiagnostic,
				code: "alice@example.com",
				field: "<script>alert(1)</script> @everyone",
				message: "alice@example.com lives at 1 Private Street",
			},
			{
				...errorDiagnostic,
				code: "referential.contact.email.invalid",
				field: "hosts[0].contacts[0].email",
			},
			{
				...errorDiagnostic,
				code: "referential.reference.speaker.unknown",
				field: "speakerReferences[0]<img>",
			},
			{ ...errorDiagnostic, code: "event.date.invalid" },
			{ ...errorDiagnostic, code: "event.date.invalid" },
		];

		// Act
		const body =
			GitHubEventCommentRepository.renderDiagnosticComment(diagnostics);

		// Assert
		expect(body).toContain(EVENT_DIAGNOSTIC_COMMENT_MARKER);
		expect(body).toContain("**Event Date**: Enter a valid calendar date");
		expect(body).toContain("**Referentials**: Ask a maintainer to correct");
		expect(body).toContain(
			"**Meetup issue**: An additional validation check needs attention",
		);
		expect(body).not.toContain("alice@example.com");
		expect(body).not.toContain("Private Street");
		expect(body).not.toContain("<script>");
		expect(body).not.toContain("<img>");
		expect(body).not.toContain("@everyone");
		expect(body).not.toContain("hosts[0]");
		expect(body).not.toContain(errorDiagnostic.message);
		expect(body).not.toContain("event.date.invalid");
		expect(body.match(/\*\*Event Date\*\*/g)).toHaveLength(1);
	});

	it("treats informational diagnostics as resolved", () => {
		// Arrange
		const diagnostics: EventDiagnostic[] = [
			{ ...errorDiagnostic, severity: "info", code: "event.date.normalized" },
		];

		// Act
		const body =
			GitHubEventCommentRepository.renderDiagnosticComment(diagnostics);

		// Assert
		expect(body).toContain("No changes are currently needed");
		expect(body).not.toContain("event.date.normalized");
	});
});

describe("GitHubEventCommentRepository", () => {
	it("creates one managed comment when actionable diagnostics appear", async () => {
		// Arrange
		const github = client();
		github.listComments.mockResolvedValue({ data: [], headers: { link: "" } });
		github.createComment.mockResolvedValue({ data: {} });

		// Act
		const result = await adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		// Assert
		expect(result).toEqual({ changed: true });
		expect(github.createComment).toHaveBeenCalledOnce();
		expect(github.createComment).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: "example",
				repo: "meetups",
				issue_number: 42,
				body: expect.stringContaining(
					"**Event Date**: Enter a valid calendar date",
				),
			}),
		);
	});

	it("does nothing when no managed comment or actionable diagnostic exists", async () => {
		// Arrange
		const github = client();
		github.listComments.mockResolvedValue({ data: [] });

		// Act
		const actual = await adapter(github.value).reconcileDiagnostics(
			identity,
			[],
		);

		// Assert
		expect(actual).toEqual({ changed: false });
		expect(github.createComment).not.toHaveBeenCalled();
		expect(github.updateComment).not.toHaveBeenCalled();
	});

	it("does not update a canonical comment whose content is unchanged", async () => {
		// Arrange
		const github = client();
		const body = GitHubEventCommentRepository.renderDiagnosticComment([
			errorDiagnostic,
		]);
		github.listComments.mockResolvedValue({ data: [comment(5, body)] });

		// Act
		const result = await adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		// Assert
		expect(result).toEqual({ changed: false });
		expect(github.updateComment).not.toHaveBeenCalled();
	});

	it("replaces a code-only managed comment with actionable guidance", async () => {
		// Arrange
		const github = client();
		github.listComments.mockResolvedValueOnce({
			data: [
				comment(
					5,
					`${EVENT_DIAGNOSTIC_COMMENT_MARKER}\n\n### Meetup automation diagnostics\n\n- **error** \`event.date.invalid\``,
				),
			],
		});
		github.updateComment.mockResolvedValue({ data: {} });

		// Act
		await adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		// Assert
		expect(github.updateComment).toHaveBeenLastCalledWith(
			expect.objectContaining({
				comment_id: 5,
				body: expect.stringContaining(
					"**Event Date**: Enter a valid calendar date",
				),
			}),
		);
	});

	it("marks an existing managed comment resolved after diagnostics clear", async () => {
		// Arrange
		const github = client();
		github.updateComment.mockResolvedValue({ data: {} });
		github.listComments.mockResolvedValueOnce({
			data: [
				comment(
					5,
					GitHubEventCommentRepository.renderDiagnosticComment([
						errorDiagnostic,
					]),
				),
			],
		});

		// Act
		await adapter(github.value).reconcileDiagnostics(identity, []);

		// Assert
		expect(github.updateComment).toHaveBeenLastCalledWith(
			expect.objectContaining({
				comment_id: 5,
				body: expect.stringContaining("No changes are currently needed"),
			}),
		);
	});

	it("paginates and deterministically tombstones duplicate managed comments", async () => {
		// Arrange
		const github = client();
		const body = GitHubEventCommentRepository.renderDiagnosticComment([
			errorDiagnostic,
		]);
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

		// Act
		const result = await adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);
		const actual = github.updateComment.mock.calls.map(
			([input]) => input.comment_id,
		);
		const actual1 = github.updateComment.mock.calls.every(([input]) =>
			input.body.includes("Superseded duplicate"),
		);
		const actual2 = github.minimizeComment.mock.calls.map(
			([input]) => input.commentId,
		);

		// Assert
		expect(result).toEqual({ changed: true });
		expect(github.listComments).toHaveBeenCalledTimes(2);
		expect(actual).toEqual([7, 9]);
		expect(actual1).toBe(true);
		expect(actual2).toEqual([7, 9]);
	});

	it("uses the configured author to avoid taking over another user's marker", async () => {
		// Arrange
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

		// Act
		await adapter(github.value, "meetup-bot").reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		// Assert
		expect(github.updateComment).not.toHaveBeenCalled();
		expect(github.createComment).toHaveBeenCalledOnce();
	});

	it("rejects a malformed comment list response", async () => {
		// Arrange
		const github = client();
		github.listComments.mockResolvedValue({ data: "not-an-array" });

		// Act
		const operation = adapter(github.value).reconcileDiagnostics(identity, [
			errorDiagnostic,
		]);

		// Assert
		await expect(operation).rejects.toBeInstanceOf(
			GitHubEventCommentRepositoryResponseError,
		);
	});

	it("rejects comment reconciliation outside the configured repository", async () => {
		// Arrange
		const github = client();

		// Act
		const operation = adapter(github.value).reconcileDiagnostics(
			{ repository: "someone/else", issueNumber: 42 },
			[errorDiagnostic],
		);

		// Assert
		await expect(operation).rejects.toBeInstanceOf(
			GitHubEventCommentRepositoryScopeError,
		);
	});

	it("rejects an invalid repository configuration", async () => {
		// Arrange
		const github = client();

		// Act
		const construct = () =>
			new GitHubEventCommentRepository(github.value, {
				owner: "",
				repo: "x",
			});

		// Assert
		expect(construct).toThrow(GitHubEventCommentRepositoryConfigurationError);
	});
});
