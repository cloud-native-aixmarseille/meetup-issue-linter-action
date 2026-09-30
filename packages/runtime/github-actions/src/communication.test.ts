import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunicationRuntime } from "./communication.js";
import { OrganizerNotificationMessages } from "./notifications/organizer-notification-messages.js";

const { getOctokitMock } = vi.hoisted(() => ({
	getOctokitMock: vi.fn(),
}));

vi.mock("@actions/github", () => ({ getOctokit: getOctokitMock }));

const temporaryRoots: string[] = [];

afterEach(async () => {
	vi.restoreAllMocks();
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
	it.each(["example-community", "another-community"])(
		"dispatches to %s/mailings and records the same approval destination",
		async (owner) => {
			// Arrange
			const workspaceRoot = await createWorkspace();
			const clients = githubClients();
			getOctokitMock.mockImplementation((token: string) =>
				token === "github-token" ? clients.github : clients.mailings,
			);
			const trigger = approvalTrigger();

			// Act
			const result = await CommunicationRuntime.runCommunicationReconcile(
				runtimeInput(workspaceRoot, {
					owner,
					approvalTrigger: {
						...trigger,
						issueSnapshot: {
							...trigger.issueSnapshot,
							identity: { repository: `${owner}/meetups`, issueNumber: 42 },
						},
					},
				}),
			);
			const approvalComment = clients.comments.find(({ body }) =>
				body.startsWith("<!-- meetup-automation:communication-approval:v1 -->"),
			);

			// Assert
			expect(result.mode).toBe("dispatch");
			expect(result.counts.accepted).toBe(2);
			expect(clients.createDispatchEvent).toHaveBeenCalledTimes(2);
			for (const [dispatch] of clients.createDispatchEvent.mock.calls) {
				expect(dispatch).toMatchObject({ owner, repo: "mailings" });
			}
			expect(approvalComment?.body).toContain(
				`"mailingsRepository": "${owner}/mailings"`,
			);
		},
	);

	it.each([
		["locale", "en", ""],
		["French notification wording", "fr", "organizer-attention.fr.v1"],
	])(
		"requires new approval after a %s change without resending recorded deliveries",
		async (_change, previousLocale, previousRevision) => {
			// Arrange
			const workspaceRoot = await createWorkspace();
			const clients = githubClients();
			getOctokitMock.mockImplementation((token: string) =>
				token === "github-token" ? clients.github : clients.mailings,
			);
			const input = runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
			});
			const revision = vi
				.spyOn(OrganizerNotificationMessages.prototype, "policyRevision", "get")
				.mockReturnValueOnce(previousRevision);
			await CommunicationRuntime.runCommunicationReconcile({
				...input,
				locale: previousLocale,
				approvalTrigger: approvalTrigger(),
			});
			revision.mockRestore();
			clients.createDispatchEvent.mockClear();
			// Act
			const stale = await CommunicationRuntime.runCommunicationReconcile({
				...input,
				locale: "fr",
			});
			const approved = await CommunicationRuntime.runCommunicationReconcile({
				...input,
				locale: "fr",
				approvalTrigger: approvalTrigger(),
			});
			// Assert
			expect(stale.mode).toBe("check");
			expect(stale.runtimeDiagnostics).toContainEqual({
				code: "communication.approval-stale",
				severity: "warning",
			});
			expect(approved.mode).toBe("dispatch");
			expect(approved.counts.alreadyRecorded).toBe(2);
			expect(clients.createDispatchEvent).not.toHaveBeenCalled();
			expect(
				clients.comments.some(({ body }) =>
					body.includes("organizer-attention.fr.v2"),
				),
			).toBe(true);
		},
	);

	it("requires a stable caller revision before reading repository state", async () => {
		// Arrange
		// No additional setup is needed.

		// Act
		const operation = CommunicationRuntime.runCommunicationReconcile(
			runtimeInput("/not-read", { automationRevision: "" }),
		);

		// Assert
		await expect(operation).rejects.toThrow(/automationRevision/);
		expect(getOctokitMock).not.toHaveBeenCalled();
	});

	it("dispatches opted-in stable-ID recipients and returns no contact data", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);
		const publicResult = JSON.stringify(result);

		// Assert
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
		for (const restrictedValue of [
			"host@example.invalid",
			"speaker@example.invalid",
			"Private Host Contact",
			"1 Private Street",
		]) {
			expect(publicResult).not.toContain(restrictedValue);
		}
	});

	it("blocks delivery without the approval label", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients({
			labels: ["meetup", "hoster:confirmed", "speakers:confirmed"],
		});
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.counts).toMatchObject({
			planned: 2,
			reserved: 0,
			dispatched: 0,
		});
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-label-missing",
			severity: "warning",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.updateComment).not.toHaveBeenCalled();
	});

	it.each([
		["en", "Meetup event issue #42 requires organizer attention."],
		["fr", "Le ticket du meetup #42 nécessite l'attention des organisateurs."],
	])(
		"uses fixed PII-free %s content for an enabled Slack reminder",
		async (locale, expected) => {
			// Arrange
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

			// Act
			const result = await CommunicationRuntime.runCommunicationReconcile(
				runtimeInput(workspaceRoot, {
					locale,
					mailingsToken: "mailings-token",
					slackToken: "slack-token",
					slackChannelId: "channel-safe-id",
					approvalTrigger: approvalTrigger(eventDate, labels),
				}),
			);
			const request = fetcher.mock.calls[0]?.[1] as { body: string };
			const payload = JSON.parse(request.body) as Record<string, unknown>;

			// Assert
			expect(result.counts).toMatchObject({
				planned: 1,
				reserved: 1,
				dispatched: 1,
				accepted: 1,
			});
			expect(fetcher).toHaveBeenCalledOnce();
			expect(payload.text).toBe(expected);
			expect(request.body).not.toContain("Private Host Contact");
			expect(request.body).not.toContain("speaker@example.invalid");
			expect(
				clients.comments.every(({ body }) => !body.includes("channel-safe-id")),
			).toBe(true);
		},
	);

	it("never blesses an edited event merely because its approval label remains", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);
		await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				approvalTrigger: approvalTrigger(),
			}),
		);
		clients.createDispatchEvent.mockClear();
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

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
			}),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-stale",
			severity: "warning",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(clients.comments).toHaveLength(2);
	});

	it("does not capture approval without an authorized label transition actor", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients({ permission: "read" });
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-capture-unauthorized",
			severity: "error",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(clients.createComment).not.toHaveBeenCalled();
	});

	it("does not reuse an existing approval for an unauthorized label event", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);
		await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				approvalTrigger: approvalTrigger(),
			}),
		);
		clients.createDispatchEvent.mockClear();
		clients.github.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
			data: { permission: "read" },
		});

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);
		const actual = clients.comments.filter(({ body }) =>
			body.startsWith("<!-- meetup-automation:communication-approval:v1 -->"),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-capture-unauthorized",
			severity: "error",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(actual).toHaveLength(1);
	});

	it("invalidates approval when the checked-out automation revision changes", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		// Act
		await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				approvalTrigger: approvalTrigger(),
			}),
		);
		clients.createDispatchEvent.mockClear();
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				automationRevision: "revision-next",
			}),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-stale",
			severity: "warning",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("rejects a label event whose immutable issue snapshot is stale", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients({ eventDate: "2099-06-09" });
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-trigger-stale",
			severity: "error",
		});
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("rejects approval capture when the label webhook snapshot is absent", async () => {
		// Arrange
		const workspaceRoot = await createWorkspace();
		const clients = githubClients();
		getOctokitMock.mockImplementation((token: string) =>
			token === "github-token" ? clients.github : clients.mailings,
		);

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				approvalTrigger: {
					action: "labeled",
					label: "communication:approved",
					actor: "maintainer",
				},
			}),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.approval-trigger-snapshot-missing",
			severity: "error",
		});
		expect(clients.createComment).not.toHaveBeenCalled();
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
	});

	it("fails closed if the issue changes after approval capture but before delivery", async () => {
		// Arrange
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

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				approvalTrigger: approvalTrigger(),
			}),
		);

		// Assert
		expect(result.mode).toBe("check");
		expect(result.runtimeDiagnostics).toContainEqual({
			code: "communication.event-concurrently-modified",
			severity: "error",
		});
		expect(clients.createDispatchEvent).not.toHaveBeenCalled();
		expect(clients.comments).toHaveLength(1);
	});

	it("does not capture approval or dispatch with an invalid referential catalog", async () => {
		// Arrange
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

		// Act
		const result = await CommunicationRuntime.runCommunicationReconcile(
			runtimeInput(workspaceRoot, {
				mailingsToken: "mailings-token",
				slackToken: "slack-token",
				slackChannelId: "channel-safe-id",
				approvalTrigger: approvalTrigger(eventDate, labels),
			}),
		);

		// Assert
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
	override: Partial<
		Parameters<typeof CommunicationRuntime.runCommunicationReconcile>[0]
	> = {},
): Parameters<typeof CommunicationRuntime.runCommunicationReconcile>[0] {
	return {
		issueNumber: 42,
		githubToken: "github-token",
		mailingsToken: "mailings-token",
		slackToken: "slack-token",
		slackChannelId: "channel-safe-id",
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
