import {
	type CommunicationApprovalFacts,
	createCommunicationApprovalSnapshot,
} from "@meetup-automation/communication";
import { describe, expect, it, vi } from "vitest";
import {
	COMMUNICATION_APPROVAL_COMMENT_MARKER,
	GithubCommunicationApprovalRepository,
	type GithubCommunicationApprovalRepositoryClient,
} from "../src/index.js";

const TRUSTED_AUTHOR = "automation-bot[bot]";

const FACTS: CommunicationApprovalFacts = {
	automationRevision: "revision-abc123",
	eventId: "issue-42",
	eventDate: "2026-10-08",
	occurrenceStatus: "scheduled",
	readiness: "ready",
	policyVersion: "1",
	mailingsRepository: "organization/mailings",
	notificationEnabled: true,
	notificationDestinationFingerprint: `sha256:${"a".repeat(64)}`,
	confirmations: { host: true, speakers: true },
	hostId: "host-0001",
	speakerIds: ["speaker-0002", "speaker-0001"],
	publicationUrls: {
		meetup: "https://meetup.example/events/42",
		community: "https://community.example/events/42",
		assets: "https://assets.example/folders/42",
	},
};

describe("GithubCommunicationApprovalRepository", () => {
	it("persists and reads one deterministic PII-free managed comment", async () => {
		const memory = commentClient();
		const repository = createRepository(memory.client);
		const snapshot = createCommunicationApprovalSnapshot(FACTS);

		await expect(repository.saveApproved(snapshot)).resolves.toEqual({
			changed: true,
		});
		await expect(repository.findApproved("issue-42")).resolves.toEqual(
			snapshot,
		);
		expect(memory.comments).toHaveLength(1);
		expect(
			memory.comments[0]?.body.startsWith(
				COMMUNICATION_APPROVAL_COMMENT_MARKER,
			),
		).toBe(true);
		expect(memory.createComment).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: "organization",
				repo: "meetups",
				issue_number: 42,
			}),
		);
		for (const privateField of ["email", "phone", "address", "contactName"]) {
			expect(memory.comments[0]?.body).not.toContain(privateField);
		}
	});

	it("ignores an approval marker authored by anyone except the configured bot", async () => {
		const snapshot = createCommunicationApprovalSnapshot(FACTS);
		const memory = commentClient([
			{
				id: 1,
				body: approvalBody(snapshot),
				user: { login: "untrusted-user" },
			},
		]);
		const repository = createRepository(memory.client);

		await expect(repository.findApproved("issue-42")).resolves.toBeUndefined();
		await expect(repository.saveApproved(snapshot)).resolves.toEqual({
			changed: true,
		});
		expect(memory.comments).toHaveLength(2);
		expect(memory.createComment).toHaveBeenCalledOnce();
	});

	it("does not write an identical approval and updates changed facts", async () => {
		const memory = commentClient();
		const repository = createRepository(memory.client);
		const initial = createCommunicationApprovalSnapshot(FACTS);
		await repository.saveApproved(initial);

		await expect(repository.saveApproved(initial)).resolves.toEqual({
			changed: false,
		});
		expect(memory.updateComment).not.toHaveBeenCalled();

		const changed = createCommunicationApprovalSnapshot({
			...FACTS,
			readiness: "not-ready",
			confirmations: { host: false, speakers: true },
		});
		await expect(repository.saveApproved(changed)).resolves.toEqual({
			changed: true,
		});
		expect(memory.updateComment).toHaveBeenCalledOnce();
		await expect(repository.findApproved("issue-42")).resolves.toEqual(changed);
	});

	it("fails closed for duplicate or corrupted trusted comments", async () => {
		const snapshot = createCommunicationApprovalSnapshot(FACTS);
		const duplicate = commentClient([
			trustedComment(1, approvalBody(snapshot)),
			trustedComment(2, approvalBody(snapshot)),
		]);
		await expect(
			createRepository(duplicate.client).findApproved("issue-42"),
		).rejects.toThrow(/Multiple trusted/);

		const corrupted = commentClient([
			trustedComment(
				1,
				`${COMMUNICATION_APPROVAL_COMMENT_MARKER}\n\n\`\`\`json\n{"email":"private@example.invalid"}\n\`\`\``,
			),
		]);
		await expect(
			createRepository(corrupted.client).findApproved("issue-42"),
		).rejects.toThrow(/corrupted/);
	});

	it("rejects a trusted snapshot for another event", async () => {
		const body = approvalBody(
			createCommunicationApprovalSnapshot({ ...FACTS, eventId: "issue-43" }),
		);
		const memory = commentClient([trustedComment(1, body)]);

		await expect(
			createRepository(memory.client).findApproved("issue-42"),
		).rejects.toThrow(/another event/);
	});

	it("validates its repository, issue, and trusted-author scope", () => {
		const memory = commentClient();
		for (const options of [
			{
				owner: "bad/owner",
				repo: "meetups",
				issueNumber: 42,
				trustedAuthorLogin: TRUSTED_AUTHOR,
			},
			{
				owner: "organization",
				repo: "",
				issueNumber: 42,
				trustedAuthorLogin: TRUSTED_AUTHOR,
			},
			{
				owner: "organization",
				repo: "meetups",
				issueNumber: 0,
				trustedAuthorLogin: TRUSTED_AUTHOR,
			},
			{
				owner: "organization",
				repo: "meetups",
				issueNumber: 42,
				trustedAuthorLogin: "",
			},
		]) {
			expect(
				() => new GithubCommunicationApprovalRepository(memory.client, options),
			).toThrow();
		}
	});
});

function createRepository(client: GithubCommunicationApprovalRepositoryClient) {
	return new GithubCommunicationApprovalRepository(client, {
		owner: "organization",
		repo: "meetups",
		issueNumber: 42,
		trustedAuthorLogin: TRUSTED_AUTHOR,
	});
}

type RawComment = {
	id: number;
	body: string;
	user: { login: string };
};

function commentClient(initial: readonly RawComment[] = []) {
	const comments = initial.map((comment) => ({
		...comment,
		user: { ...comment.user },
	}));
	let nextId = Math.max(0, ...comments.map(({ id }) => id)) + 1;
	const createComment = vi.fn(
		async (parameters: { body: string }): Promise<void> => {
			comments.push({
				id: nextId++,
				body: parameters.body,
				user: { login: TRUSTED_AUTHOR },
			});
		},
	);
	const updateComment = vi.fn(
		async (parameters: { comment_id: number; body: string }): Promise<void> => {
			const comment = comments.find(({ id }) => id === parameters.comment_id);
			if (!comment) throw new Error("missing synthetic comment");
			comment.body = parameters.body;
		},
	);
	const client = {
		rest: {
			issues: {
				listComments: vi.fn().mockImplementation(async () => ({
					data: comments.map((comment) => ({
						...comment,
						user: { ...comment.user },
					})),
					headers: {},
				})),
				createComment,
				updateComment,
			},
		},
	} satisfies GithubCommunicationApprovalRepositoryClient;
	return { client, comments, createComment, updateComment };
}

function trustedComment(id: number, body: string): RawComment {
	return { id, body, user: { login: TRUSTED_AUTHOR } };
}

function approvalBody(
	snapshot: ReturnType<typeof createCommunicationApprovalSnapshot>,
): string {
	return `${COMMUNICATION_APPROVAL_COMMENT_MARKER}\n\nMaintainer-approved communication facts. Any fact change requires a new approval.\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``;
}
