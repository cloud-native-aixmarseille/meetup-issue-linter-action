import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getOctokitMock } = vi.hoisted(() => ({
	getOctokitMock: vi.fn(),
}));

vi.mock("@actions/github", () => ({ getOctokit: getOctokitMock }));

import { runCommunicationReconcile } from "./communication.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	getOctokitMock.mockReset();
	await Promise.all(
		temporaryRoots.splice(0).map((root) =>
			rm(root, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("runCommunicationReconcile", () => {
	it("requires a stable caller revision before reading repository state", async () => {
		await expect(
			runCommunicationReconcile(
				runtimeInput("/not-read", { automationRevision: "" }),
			),
		).rejects.toThrow(/automationRevision/);
		expect(getOctokitMock).not.toHaveBeenCalled();
	});

	it("dispatches opted-in stable-ID recipients and returns no contact data", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		expect(result).toMatchObject({
			mode: "dispatch",
			counts: {
				planned: 2,
				reserved: 2,
				dispatched: 2,
				accepted: 2,
			},
		});
		expect(clients.createDispatchEvent).toHaveBeenCalledTimes(2);
		expect(clients.createDispatchEvent.mock.calls).toEqual(
			expect.arrayContaining([
				[
					expect.objectContaining({
						client_payload: expect.objectContaining({
							"template-name": "meetup-intro-hosting",
							"to-email": "host@example.invalid",
						}),
					}),
				],
				[
					expect.objectContaining({
						client_payload: expect.objectContaining({
							"template-name": "meetup-intro-speakers",
							"to-email": "speaker@example.invalid",
						}),
					}),
				],
			]),
		);
		expect(clients.createDispatchEvent).not.toHaveBeenCalledWith(
			expect.objectContaining({
				client_payload: expect.objectContaining({
					"to-email": "host-opted-out@example.invalid",
				}),
			}),
		);
		expect(clients.comments).toHaveLength(2);
		expect(
			clients.comments.find(({ body }) =>
				body.startsWith("<!-- meetup-automation-delivery-ledger:v1 -->"),
			)?.body,
		).toContain('"status": "accepted"');

		const publicResult = JSON.stringify(result);
		for (const restrictedValue of [
			"host@example.invalid",
			"speaker@example.invalid",
			"Private Host Contact",
			"1 Private Street",
		]) {
			expect(publicResult).not.toContain(restrictedValue);
		}
	});

	it("keeps mail intents in the plan without reserving when its token is missing", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockReturnValue(clients.github);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "",
			}),
		);

		expect(result.counts).toMatchObject({
			planned: 2,
			due: 2,
			reserved: 0,
			dispatched: 0,
		});
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.mail-gateway-disabled-missing-credential",
			severity: "warning",
		});
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.updateComment).not.toHaveBeenCalled();
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("stays read-only unless dispatch is authorized by the caller workflow", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: false,
				mailingsToken: "mailings-token",
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.counts).toMatchObject({
			planned: 2,
			due: 2,
			reserved: 0,
			dispatched: 0,
		});
		expect(result.runtimeDiagnostics.map((item) => item.code)).toContain(
			"communication.dispatch-not-authorized",
		);
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.updateComment).not.toHaveBeenCalled();
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("uses fixed PII-free content for an enabled Slack reminder", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-04T10:00:00.000Z"));
		const eventDate = localDate(new Date(), "Europe/Paris");
		const workspaceRoot = await createWorkspace();
		const labels = ["meetup", "communication:approved"];
		const clients = githubClients({
			labels,
			eventDate,
		});
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);
		const fetcher = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true }),
		});
		vi.stubGlobal("fetch", fetcher);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				slackToken: "slack-token",
				slackChannelId: "channel-safe-id",
				approvalTrigger: approvalTrigger(eventDate, labels),
			}),
		);

		expect(result.counts).toMatchObject({
			planned: 1,
			reserved: 1,
			dispatched: 1,
			accepted: 1,
		});
		expect(fetcher).toHaveBeenCalledOnce();
		const request = fetcher.mock.calls[0]?.[1] as { body: string };
		const payload = JSON.parse(request.body) as Record<string, unknown>;
		expect(payload.text).toBe(
			"Meetup event issue #42 requires organizer attention.",
		);
		expect(request.body).not.toContain("Private Host Contact");
		expect(request.body).not.toContain("speaker@example.invalid");
		expect(
			clients.comments.every(({ body }) => !body.includes("channel-safe-id")),
		).toBe(true);
	});

	it("keeps Slack intents in the plan without reserving when its token is missing", async () => {
		const eventDate = localDate(new Date(), "Europe/Paris");
		const workspaceRoot = await createWorkspace();
		const clients = githubClients({ labels: ["meetup"], eventDate });
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				slackToken: "",
				slackChannelId: "channel-safe-id",
			}),
		);

		expect(result.counts).toMatchObject({
			planned: 1,
			due: 1,
			reserved: 0,
			dispatched: 0,
		});
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.notification-gateway-disabled-missing-credential",
			severity: "warning",
		});
		expect(fetcher).not.toHaveBeenCalled();
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.updateComment).not.toHaveBeenCalled();
	});

	it("never blesses an edited event merely because its approval label remains", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				approvalTrigger: approvalTrigger(),
			}),
		);
		const changedDate = "2099-06-09";
		clients.getIssue.mockResolvedValue({
			data: {
				number: 42,
				state: "open",
				title: `[Meetup] - ${changedDate} - Platform Night`,
				labels: [
					"meetup",
					"hoster:confirmed",
					"speakers:confirmed",
					"communication:approved",
				],
				body: eventBody(changedDate),
			},
		});

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-stale",
			severity: "warning",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(clients.comments).toHaveLength(1);
	});

	it("does not capture approval in check mode", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockReturnValue(clients.github);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "check",
				dispatchAuthorized: true,
				approvalTrigger: approvalTrigger(),
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-missing",
			severity: "warning",
		});
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.updateComment).not.toHaveBeenCalled();
	});

	it("does not capture approval without an authorized label transition actor", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients({ permission: "read" });
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-capture-unauthorized",
			severity: "error",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(clients.createComment).not.toHaveBeenCalled();
	});

	it("does not reuse an existing approval for an unauthorized label event", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				approvalTrigger: approvalTrigger(),
			}),
		);
		clients.github.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
			data: { permission: "read" },
		});

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-capture-unauthorized",
			severity: "error",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(
			clients.comments.filter(({ body }) =>
				body.startsWith("<!-- meetup-automation:communication-approval:v1 -->"),
			),
		).toHaveLength(1);
	});

	it("invalidates approval when the checked-out automation revision changes", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				approvalTrigger: approvalTrigger(),
			}),
		);
		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				automationRevision: "revision-next",
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-stale",
			severity: "warning",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("rejects a label event whose immutable issue snapshot is stale", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients({ eventDate: "2099-06-09" });
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-trigger-stale",
			severity: "error",
		});
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("rejects approval capture when the label webhook snapshot is absent", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				approvalTrigger: {
					action: "labeled",
					label: "communication:approved",
					actor: "maintainer",
				},
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-trigger-snapshot-missing",
			severity: "error",
		});
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("fails closed if the issue changes after approval capture but before delivery", async () => {
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		clients.getIssue
			.mockReset()
			.mockResolvedValueOnce(githubIssueResponse("2099-06-08"))
			.mockResolvedValueOnce(githubIssueResponse("2099-06-08"))
			.mockResolvedValue(githubIssueResponse("2099-06-09"));
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.event-concurrently-modified",
			severity: "error",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(clients.comments).toHaveLength(1);
	});

	it("does not capture approval or dispatch with an invalid referential catalog", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-04T10:00:00.000Z"));
		const eventDate = localDate(new Date(), "Europe/Paris");
		const labels = ["meetup", "communication:approved"];
		const workspaceRoot = await createWorkspace();
		await writeFile(
			join(workspaceRoot, "referentials", "hosting.csv"),
			"invalid_header\ninvalid_value\n",
			"utf8",
		);
		const clients = githubClients({ labels, eventDate });
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);

		const result = await runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				requestedMode: "dispatch",
				dispatchAuthorized: true,
				mailingsToken: "mailings-token",
				slackToken: "slack-token",
				slackChannelId: "channel-safe-id",
				approvalTrigger: approvalTrigger(eventDate, labels),
			}),
		);

		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.referential-catalog-invalid",
			severity: "error",
		});
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.updateComment).not.toHaveBeenCalled();
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(fetcher).not.toHaveBeenCalled();
	});
});

async function createWorkspace(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "meetup-communication-runtime-"));
	temporaryRoots.push(root);
	await mkdir(join(root, "referentials"), { recursive: true });
	await writeFile(
		join(root, "referentials", "hosting.csv"),
		`host_id,name,contact_id,contact,mail,phone,address
host-0001,Public Venue,contact-0001,Private Host Contact,host@example.invalid,,"1 Private Street"
host-0001,Public Venue,contact-0002,Opted Out Contact,host-opted-out@example.invalid,,"1 Private Street"
`,
		"utf8",
	);
	await writeFile(
		join(root, "referentials", "speakers.csv"),
		`speaker_id,firstname,lastname,company,mail,phone
speaker-0001,Ada,Speaker,Public Company,speaker@example.invalid,
`,
		"utf8",
	);
	return root;
}

function runtimeInput(
	workspaceRoot: string,
	override: Partial<Parameters<typeof runCommunicationReconcile>[0]> = {},
): Parameters<typeof runCommunicationReconcile>[0] {
	return {
		issueNumber: 42,
		configPath: ".github/meetup-automation.yml",
		requestedMode: "check",
		dispatchAuthorized: false,
		githubToken: "github-token",
		mailingsToken: "",
		slackToken: "",
		slackChannelId: "",
		owner: "organization",
		repo: "meetups",
		automationRevision: "revision-test",
		managedCommentAuthor: "automation[bot]",
		workspaceRoot,
		...override,
	};
}

function githubClients(
	override: {
		labels?: readonly string[];
		eventDate?: string;
		permission?: string;
	} = {},
) {
	const labels = override.labels ?? [
		"meetup",
		"hoster:confirmed",
		"speakers:confirmed",
		"communication:approved",
	];
	const eventDate = override.eventDate ?? "2099-06-08";
	const comments: Array<{ id: number; body: string; user: { login: string } }> =
		[];
	const getIssue = vi.fn().mockResolvedValue({
		data: {
			number: 42,
			state: "open",
			title: `[Meetup] - ${eventDate} - Platform Night`,
			labels,
			body: eventBody(eventDate),
		},
	});
	const createComment = vi.fn(
		async (parameters: { body: string }): Promise<void> => {
			comments.push({
				id: 100 + comments.length,
				body: parameters.body,
				user: { login: "automation[bot]" },
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
	const github = {
		rest: {
			issues: {
				get: getIssue,
				update: vi.fn(),
				listForRepo: vi.fn(),
				listComments: vi.fn().mockImplementation(async () => ({
					data: comments.map((comment) => ({ ...comment })),
					headers: {},
				})),
				createComment,
				updateComment,
			},
			repos: {
				getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
					data: { permission: override.permission ?? "maintain" },
				}),
			},
		},
	};
	const createDispatchEvent = vi.fn().mockResolvedValue({ status: 204 });
	const mailings = {
		rest: { repos: { createDispatchEvent } },
	};
	return {
		comments,
		github,
		mailings,
		createComment,
		updateComment,
		createDispatchEvent,
		getIssue,
	};
}

function githubIssueResponse(
	eventDate: string,
	labels: readonly string[] = [
		"meetup",
		"hoster:confirmed",
		"speakers:confirmed",
		"communication:approved",
	],
) {
	return {
		data: {
			number: 42,
			state: "open",
			title: `[Meetup] - ${eventDate} - Platform Night`,
			labels,
			body: eventBody(eventDate),
		},
	};
}

function approvalTrigger(
	eventDate = "2099-06-08",
	labels: readonly string[] = [
		"meetup",
		"hoster:confirmed",
		"speakers:confirmed",
		"communication:approved",
	],
) {
	return {
		action: "labeled",
		label: "communication:approved",
		actor: "maintainer",
		issueSnapshot: {
			identity: { repository: "organization/meetups", issueNumber: 42 },
			issueState: "open",
			issueTitle: `[Meetup] - ${eventDate} - Platform Night`,
			labels,
			body: eventBody(eventDate),
		},
	} as const;
}

function eventBody(eventDate: string): string {
	return `<!-- meetup-event-schema:1 -->
<!-- meetup-event-references:{"schemaVersion":2,"host":{"id":"host-0001","displayName":"Public Venue"},"speakers":[{"id":"speaker-0001","displayName":"Ada Speaker"}]} -->
### Event Title

Platform Night

### Event Date

${eventDate}

### Hoster

Public Venue

### Event Description

Public event description.

### Agenda

- Ada Speaker: A public talk

### Meetup Link

https://www.meetup.com/cloud-native-aix-marseille/events/123

### CNCF Link

https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/platform-night

### Drive Link

https://drive.google.com/drive/folders/public-event-assets
`;
}

function localDate(value: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(value);
	const values = new Map(parts.map((part) => [part.type, part.value]));
	return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}
