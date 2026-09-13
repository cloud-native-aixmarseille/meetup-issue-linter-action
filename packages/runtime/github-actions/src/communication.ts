import { createHash } from "node:crypto";
import { getOctokit } from "@actions/github";
import {
	communicationApprovalMatches,
	createCommunicationApprovalSnapshot,
	type GatewayDispatchResult,
	isSafeCommunicationIdentifier,
	type MailGateway,
	type MailRecipient,
	type NotificationRecipient,
	PlanCommunications,
	ReconcileCommunications,
	type ReconcileCommunicationsResult,
} from "@meetup-automation/communication";
import {
	type EventDocument,
	type EventIdentity,
	type EventRepository,
	eventDocumentsEqual,
} from "@meetup-automation/event";
import { GithubCommunicationApprovalRepository } from "@meetup-automation/github-communication-approval-repository";
import {
	GithubDeliveryLedger,
	type GithubLedgerComment,
	type GithubLedgerCommentClient,
} from "@meetup-automation/github-delivery-ledger";
import { GithubRepositoryDispatchMailGateway } from "@meetup-automation/github-repository-dispatch-mail-gateway";
import {
	type AutomationConfig,
	ManageMeetupEvent,
} from "@meetup-automation/journey";
import {
	type ReferentialCatalog,
	type ReferentialRepository,
	ResolveEventReferences,
	type Speaker,
	ValidateReferentialCatalog,
} from "@meetup-automation/referential";
import { SlackNotificationGateway } from "@meetup-automation/slack-notification-gateway";
import { SystemCommunicationClock } from "@meetup-automation/system-clock";
import {
	createEventComposition,
	createReferentialRepository,
	type GitHubClient,
	workspaceConfigRepository,
} from "./composition.js";

export interface RunCommunicationReconcileInput {
	readonly issueNumber: number;
	readonly configPath: string;
	readonly requestedMode: "check" | "dispatch";
	readonly dispatchAuthorized: boolean;
	readonly githubToken: string;
	readonly mailingsToken: string;
	readonly slackToken: string;
	readonly slackChannelId: string;
	readonly owner: string;
	readonly repo: string;
	readonly repositoryId?: string;
	/** Caller revision which owns the configuration and private referentials. */
	readonly automationRevision: string;
	readonly workspaceRoot?: string;
	readonly managedCommentAuthor: string;
	readonly approvalTrigger?: Readonly<{
		action: string;
		label: string;
		actor: string;
		/** Immutable issue snapshot delivered with the GitHub label event. */
		issueSnapshot?: EventDocument;
	}>;
}

type CommunicationRuntimeDiagnosticCode =
	| "communication.dispatch-disabled-by-config"
	| "communication.dispatch-not-authorized"
	| "communication.approval-label-missing"
	| "communication.approval-missing"
	| "communication.approval-stale"
	| "communication.approval-capture-unauthorized"
	| "communication.approval-trigger-snapshot-missing"
	| "communication.approval-trigger-stale"
	| "communication.approval-repository-failed"
	| "communication.event-skipped"
	| "communication.event-concurrently-modified"
	| "communication.event-references-unresolved"
	| "communication.github-credential-missing"
	| "communication.mail-gateway-disabled-missing-credential"
	| "communication.notification-gateway-disabled-missing-credential"
	| "communication.notification-gateway-disabled-missing-destination"
	| "communication.referential-catalog-invalid";

export interface CommunicationRuntimeDiagnostic {
	readonly code: CommunicationRuntimeDiagnosticCode;
	readonly severity: "info" | "warning" | "error";
}

export type RunCommunicationReconcileResult = ReconcileCommunicationsResult &
	Readonly<{
		runtimeDiagnostics: readonly CommunicationRuntimeDiagnostic[];
	}>;

/**
 * Compose the checked-out event and referentials with the communication ports.
 * The returned value contains stable identifiers and counts only; recipient
 * addresses and provider payloads never cross this runtime boundary.
 */
export async function runCommunicationReconcile(
	input: RunCommunicationReconcileInput,
): Promise<RunCommunicationReconcileResult> {
	assertInput(input);
	const runtimeDiagnostics: CommunicationRuntimeDiagnostic[] = [];
	const workspaceRoot = input.workspaceRoot ?? process.cwd();
	const configRepository = workspaceConfigRepository(workspaceRoot);
	const config = await configRepository.load();
	const dispatchPermitted = resolveDispatchMode(
		input,
		config,
		runtimeDiagnostics,
	);

	const githubToken = input.githubToken.trim();
	if (!githubToken) {
		runtimeDiagnostics.push({
			code: "communication.github-credential-missing",
			severity: "error",
		});
		return emptyResult("check", runtimeDiagnostics);
	}

	const githubClient = getOctokit(githubToken);
	const baseReferentialRepository = createReferentialRepository(
		config,
		workspaceRoot,
	);
	const referentialRepository = cachedRepository(baseReferentialRepository);
	const repositoryName = `${input.owner}/${input.repo}`;
	const identity = {
		repository: repositoryName,
		issueNumber: input.issueNumber,
	} as const;
	const eventDependencies = createEventComposition({
		client: githubClient,
		owner: input.owner,
		repo: input.repo,
		config,
		commentAuthorLogin: input.managedCommentAuthor,
	});
	const sourceDocument = await eventDependencies.repository.find(identity);
	if (!sourceDocument) {
		throw new Error(
			`Meetup event ${repositoryName}#${input.issueNumber} was not found`,
		);
	}
	const journey = new ManageMeetupEvent({
		configRepository: { load: async () => config },
		createReferentialRepository: () => referentialRepository,
		createEventDependencies: () => eventDependencies,
	});
	const managed = await journey.execute({
		configPath: input.configPath,
		identity,
		mode: "check",
		sourceDocument,
	});

	if (managed.skipped) {
		runtimeDiagnostics.push({
			code: "communication.event-skipped",
			severity: "info",
		});
		return emptyResult(
			dispatchPermitted ? "dispatch" : "check",
			runtimeDiagnostics,
		);
	}

	const validation = await new ValidateReferentialCatalog(
		referentialRepository,
	).execute();
	let catalog: ReferentialCatalog | undefined;
	if (validation.isValid) {
		catalog = validation.catalog;
	} else {
		runtimeDiagnostics.push({
			code: "communication.referential-catalog-invalid",
			severity: "error",
		});
	}

	const mailingsToken = input.mailingsToken.trim();
	const mailGatewayEnabled = mailingsToken.length > 0;
	if (dispatchPermitted && !mailGatewayEnabled) {
		runtimeDiagnostics.push({
			code: "communication.mail-gateway-disabled-missing-credential",
			severity: "warning",
		});
	}

	const slackToken = input.slackToken.trim();
	const slackChannelId = input.slackChannelId.trim();
	const notificationConfigured = config.communication["slack-enabled"];
	if (dispatchPermitted && notificationConfigured && !slackToken) {
		runtimeDiagnostics.push({
			code: "communication.notification-gateway-disabled-missing-credential",
			severity: "warning",
		});
	}
	if (dispatchPermitted && notificationConfigured && !slackChannelId) {
		runtimeDiagnostics.push({
			code: "communication.notification-gateway-disabled-missing-destination",
			severity: "warning",
		});
	}

	const mailRecipientResolution = catalog
		? resolveMailRecipients(managed.event, catalog, runtimeDiagnostics)
		: UNRESOLVED_MAIL_RECIPIENTS;
	const referencesResolved =
		catalog !== undefined && mailRecipientResolution.resolved;
	const notificationRecipients: readonly NotificationRecipient[] = [
		{
			channel: "notification",
			role: "organizers",
			recipientId: "organizers-slack",
			receivesCommunications: notificationConfigured,
			destination: slackChannelId,
		},
	];

	if (
		dispatchPermitted &&
		referencesResolved &&
		!(await eventSourceIsCurrent(
			eventDependencies.repository,
			identity,
			sourceDocument,
			runtimeDiagnostics,
		))
	) {
		return emptyResult("check", runtimeDiagnostics);
	}

	const communicationApproved = referencesResolved
		? await resolveCommunicationApproval({
				input,
				config,
				client: githubClient,
				captureApproval: dispatchPermitted,
				sourceDocument,
				event: managed.event,
				readiness: managed.isReady ? "ready" : "not-ready",
				notificationDestinationFingerprint:
					notificationConfigured && slackChannelId
						? protectApprovalRouteId(slackChannelId)
						: null,
				diagnostics: runtimeDiagnostics,
			})
		: false;
	const dispatchEnabled =
		dispatchPermitted &&
		referencesResolved &&
		communicationApproved &&
		!runtimeDiagnostics.some(({ severity }) => severity === "error");

	if (
		dispatchEnabled &&
		!(await eventSourceIsCurrent(
			eventDependencies.repository,
			identity,
			sourceDocument,
			runtimeDiagnostics,
		))
	) {
		return emptyResult("check", runtimeDiagnostics);
	}

	const ledger = new GithubDeliveryLedger(
		new ScopedGithubLedgerCommentClient(
			githubClient,
			input.owner,
			input.repo,
			input.issueNumber,
		),
		{
			dispatchAuthorized: dispatchEnabled,
			authorLogin: input.managedCommentAuthor,
		},
	);
	const mailGateway: MailGateway = mailGatewayEnabled
		? createMailGateway(mailingsToken, config)
		: DISABLED_MAIL_GATEWAY;
	const reconciliation = await new ReconcileCommunications({
		planner: new PlanCommunications(),
		clock: new SystemCommunicationClock(),
		ledger,
		mailGateway,
		notificationGateway: new SlackNotificationGateway(slackToken),
	}).execute({
		mode: dispatchEnabled ? "dispatch" : "check",
		dispatchCapabilities: {
			mail: mailGatewayEnabled,
			notification:
				notificationConfigured &&
				slackToken.length > 0 &&
				slackChannelId.length > 0,
		},
		repositoryId: input.repositoryId?.trim() || repositoryName,
		eventId: `issue-${input.issueNumber}`,
		eventDate: managed.event.date,
		timeZone: config.timezone,
		readiness: managed.isReady ? "ready" : "not-ready",
		occurrenceStatus: managed.event.occurrenceStatus ?? "unknown",
		policyVersion: String(config.communication["policy-version"]),
		readinessWindowDays: config.communication["readiness-window-days"],
		mailRecipients: mailRecipientResolution.recipients,
		notificationRecipients,
		mailPlaceholders: eventPlaceholders(managed.event),
		notificationContent: `Meetup event issue #${input.issueNumber} requires organizer attention.`,
	});

	return withRuntimeDiagnostics(reconciliation, runtimeDiagnostics);
}

async function resolveCommunicationApproval(input: {
	readonly input: RunCommunicationReconcileInput;
	readonly config: AutomationConfig;
	readonly client: GitHubClient;
	readonly captureApproval: boolean;
	readonly sourceDocument: EventDocument;
	readonly event: {
		readonly date: string;
		readonly labels: readonly string[];
		readonly occurrenceStatus?:
			| "scheduled"
			| "postponed"
			| "held"
			| "cancelled";
		readonly confirmations: Readonly<{ host: boolean; speakers: boolean }>;
		readonly host?: { readonly id?: string };
		readonly agenda: readonly {
			readonly speakers: readonly { readonly id?: string }[];
		}[];
		readonly publicationLinks: Readonly<{
			meetup?: string;
			community?: string;
			assets?: string;
		}>;
	};
	readonly readiness: "ready" | "not-ready";
	readonly notificationDestinationFingerprint: string | null;
	readonly diagnostics: CommunicationRuntimeDiagnostic[];
}): Promise<boolean> {
	const eventId = `issue-${input.input.issueNumber}`;
	const approvalLabel = input.config.communication["approval-label"];
	const repository = new GithubCommunicationApprovalRepository(
		input.client as unknown as ConstructorParameters<
			typeof GithubCommunicationApprovalRepository
		>[0],
		{
			owner: input.input.owner,
			repo: input.input.repo,
			issueNumber: input.input.issueNumber,
			trustedAuthorLogin: input.input.managedCommentAuthor,
		},
	);
	const current = createCommunicationApprovalSnapshot({
		automationRevision: input.input.automationRevision,
		eventId,
		eventDate: input.event.date,
		occurrenceStatus: input.event.occurrenceStatus ?? "unknown",
		readiness: input.readiness,
		policyVersion: String(input.config.communication["policy-version"]),
		mailingsRepository: input.config.communication["mailings-repository"],
		notificationEnabled: input.config.communication["slack-enabled"],
		notificationDestinationFingerprint:
			input.notificationDestinationFingerprint,
		confirmations: input.event.confirmations,
		hostId: input.event.host?.id ?? null,
		speakerIds: input.event.agenda.flatMap((entry) =>
			entry.speakers.flatMap((speaker) => (speaker.id ? [speaker.id] : [])),
		),
		publicationUrls: {
			meetup: input.event.publicationLinks.meetup ?? null,
			community: input.event.publicationLinks.community ?? null,
			assets: input.event.publicationLinks.assets ?? null,
		},
	});

	const trigger = input.input.approvalTrigger;
	const hasApprovalLabel = input.event.labels.some((label) =>
		labelsEqual(label, approvalLabel),
	);
	if (
		input.captureApproval &&
		hasApprovalLabel &&
		trigger?.action === "labeled" &&
		labelsEqual(trigger.label, approvalLabel)
	) {
		if (!trigger.issueSnapshot) {
			input.diagnostics.push({
				code: "communication.approval-trigger-snapshot-missing",
				severity: "error",
			});
			return false;
		}
		if (!eventDocumentsEqual(trigger.issueSnapshot, input.sourceDocument)) {
			input.diagnostics.push({
				code: "communication.approval-trigger-stale",
				severity: "error",
			});
			return false;
		}
		try {
			if (!(await actorCanApprove(input.client, input.input, trigger.actor))) {
				input.diagnostics.push({
					code: "communication.approval-capture-unauthorized",
					severity: "error",
				});
				return false;
			} else {
				await repository.saveApproved(current);
			}
		} catch {
			input.diagnostics.push({
				code: "communication.approval-repository-failed",
				severity: "error",
			});
			return false;
		}
	}

	if (!hasApprovalLabel) {
		input.diagnostics.push({
			code: "communication.approval-label-missing",
			severity: "warning",
		});
		return false;
	}

	try {
		const approved = await repository.findApproved(eventId);
		if (!approved) {
			input.diagnostics.push({
				code: "communication.approval-missing",
				severity: "warning",
			});
			return false;
		}
		if (!communicationApprovalMatches(approved, current.facts)) {
			input.diagnostics.push({
				code: "communication.approval-stale",
				severity: "warning",
			});
			return false;
		}
		return true;
	} catch {
		input.diagnostics.push({
			code: "communication.approval-repository-failed",
			severity: "error",
		});
		return false;
	}
}

async function actorCanApprove(
	client: GitHubClient,
	input: Pick<RunCommunicationReconcileInput, "owner" | "repo">,
	actor: string,
): Promise<boolean> {
	if (!isRepositoryPart(actor)) return false;
	const response = await client.rest.repos.getCollaboratorPermissionLevel({
		owner: input.owner,
		repo: input.repo,
		username: actor,
	});
	const data = response.data as { permission?: unknown; role_name?: unknown };
	return [data.permission, data.role_name].some(
		(value) =>
			typeof value === "string" &&
			["admin", "maintain", "write", "triage"].includes(value),
	);
}

function labelsEqual(left: string, right: string): boolean {
	return (
		left.trim().toLocaleLowerCase("en-US") ===
		right.trim().toLocaleLowerCase("en-US")
	);
}

function protectApprovalRouteId(value: string): string {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function resolveDispatchMode(
	input: RunCommunicationReconcileInput,
	config: AutomationConfig,
	diagnostics: CommunicationRuntimeDiagnostic[],
): boolean {
	if (input.requestedMode !== "dispatch") {
		return false;
	}

	const enabledByConfig = config.communication["dispatch-enabled"];
	if (!enabledByConfig) {
		diagnostics.push({
			code: "communication.dispatch-disabled-by-config",
			severity: "warning",
		});
	}
	if (!input.dispatchAuthorized) {
		diagnostics.push({
			code: "communication.dispatch-not-authorized",
			severity: "warning",
		});
	}
	return enabledByConfig && input.dispatchAuthorized;
}

type MailRecipientResolution = Readonly<{
	resolved: boolean;
	recipients: readonly MailRecipient[];
}>;

const UNRESOLVED_MAIL_RECIPIENTS: MailRecipientResolution = Object.freeze({
	resolved: false,
	recipients: Object.freeze([]),
});

async function eventSourceIsCurrent(
	repository: EventRepository,
	identity: EventIdentity,
	expected: EventDocument,
	diagnostics: CommunicationRuntimeDiagnostic[],
): Promise<boolean> {
	try {
		const current = await repository.find(identity);
		if (current && eventDocumentsEqual(current, expected)) {
			return true;
		}
	} catch {
		// A failed consistency read is indistinguishable from a stale source here.
	}
	diagnostics.push({
		code: "communication.event-concurrently-modified",
		severity: "error",
	});
	return false;
}

function resolveMailRecipients(
	event: {
		readonly host?: { readonly id?: string; readonly displayName: string };
		readonly agenda: readonly {
			readonly speakers: readonly {
				readonly id?: string;
				readonly displayName: string;
			}[];
		}[];
	},
	catalog: ReferentialCatalog,
	diagnostics: CommunicationRuntimeDiagnostic[],
): MailRecipientResolution {
	const resolution = new ResolveEventReferences().execute(catalog, {
		hostReference: event.host ? renderReference(event.host) : "",
		speakerReferences: event.agenda.flatMap((entry) =>
			entry.speakers.map(renderReference),
		),
	});
	if (!resolution.resolved) {
		diagnostics.push({
			code: "communication.event-references-unresolved",
			severity: "error",
		});
		return UNRESOLVED_MAIL_RECIPIENTS;
	}

	const eventHost = resolution.host;
	const primaryContact = eventHost.contacts[0];
	const hostingAddress = primaryContact?.address ?? "";
	const recipients: MailRecipient[] = primaryContact
		? [
				{
					channel: "mail",
					role: "hosting",
					recipientId: primaryContact.id,
					receivesCommunications: true,
					email: primaryContact.email,
					placeholders: { hostingName: eventHost.displayName },
				},
			]
		: [];

	for (const speaker of resolution.speakers) {
		recipients.push(
			speakerRecipient(speaker, eventHost.displayName, hostingAddress),
		);
	}

	return { resolved: true, recipients: Object.freeze(recipients) };
}

function speakerRecipient(
	speaker: Speaker,
	hostingName: string,
	hostingAddress: string,
): MailRecipient {
	return {
		channel: "mail",
		role: "speaker",
		recipientId: speaker.id,
		receivesCommunications: true,
		email: speaker.email,
		placeholders: {
			speakerName: speaker.firstName,
			hostingName,
			hostingAddress,
		},
	};
}

function renderReference(reference: {
	readonly id?: string;
	readonly displayName: string;
}): string {
	return reference.id
		? `${reference.displayName} [${reference.id}]`
		: reference.displayName;
}

function eventPlaceholders(event: {
	readonly date: string;
	readonly publicationLinks: Readonly<{
		meetup?: string;
		community?: string;
		assets?: string;
	}>;
}): Readonly<Record<string, string>> {
	return {
		eventDate: event.date,
		...(event.publicationLinks.meetup
			? { eventMeetupUrl: event.publicationLinks.meetup }
			: {}),
		...(event.publicationLinks.community
			? { eventCncfUrl: event.publicationLinks.community }
			: {}),
		...(event.publicationLinks.assets
			? { eventSlidesUrl: event.publicationLinks.assets }
			: {}),
	};
}

function createMailGateway(
	token: string,
	config: AutomationConfig,
): GithubRepositoryDispatchMailGateway {
	const client = getOctokit(token);
	return new GithubRepositoryDispatchMailGateway(
		{
			createDispatchEvent: (parameters) =>
				client.rest.repos.createDispatchEvent(parameters),
		},
		config.communication["mailings-repository"],
	);
}

function cachedRepository(
	repository: ReferentialRepository,
): ReferentialRepository {
	let loaded: ReturnType<ReferentialRepository["load"]> | undefined;
	return {
		load: () => {
			loaded ??= repository.load();
			return loaded;
		},
	};
}

class ScopedGithubLedgerCommentClient implements GithubLedgerCommentClient {
	constructor(
		private readonly client: GitHubClient,
		private readonly owner: string,
		private readonly repo: string,
		private readonly issueNumber: number,
	) {}

	async listComments(): Promise<readonly GithubLedgerComment[]> {
		const comments: GithubLedgerComment[] = [];
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
				throw new Error("GitHub delivery ledger comment response is invalid");
			}
			for (const value of response.data) {
				if (Number.isSafeInteger(value.id) && typeof value.body === "string") {
					comments.push({
						id: value.id,
						body: value.body,
						...(value.user?.login ? { authorLogin: value.user.login } : {}),
					});
				}
			}

			const link = response.headers.link;
			const hasNext =
				typeof link === "string"
					? /<[^>]+>;\s*rel="next"/.test(link)
					: response.data.length === 100;
			if (!hasNext) {
				return comments;
			}
			page += 1;
		}
	}

	async createComment(body: string): Promise<void> {
		await this.client.rest.issues.createComment({
			owner: this.owner,
			repo: this.repo,
			issue_number: this.issueNumber,
			body,
		});
	}

	async updateComment(commentId: number, body: string): Promise<void> {
		await this.client.rest.issues.updateComment({
			owner: this.owner,
			repo: this.repo,
			comment_id: commentId,
			body,
		});
	}
}

const DISABLED_MAIL_GATEWAY: MailGateway = Object.freeze({
	dispatch: async (): Promise<GatewayDispatchResult> => ({
		outcome: "uncertain",
		diagnosticCode: "unknown-provider-state",
	}),
});

function assertInput(input: RunCommunicationReconcileInput): void {
	if (!Number.isSafeInteger(input.issueNumber) || input.issueNumber <= 0) {
		throw new Error("issueNumber must be a positive integer");
	}
	if (!isRepositoryPart(input.owner) || !isRepositoryPart(input.repo)) {
		throw new Error("owner and repo must be valid GitHub repository segments");
	}
	if (!input.managedCommentAuthor.trim()) {
		throw new Error("managedCommentAuthor must not be empty");
	}
	if (!isSafeCommunicationIdentifier(input.automationRevision.trim())) {
		throw new Error(
			"automationRevision must be a stable, PII-free revision identifier",
		);
	}
}

function isRepositoryPart(value: string): boolean {
	return /^[A-Za-z0-9_.-]+$/.test(value);
}

function withRuntimeDiagnostics(
	result: ReconcileCommunicationsResult,
	runtimeDiagnostics: readonly CommunicationRuntimeDiagnostic[],
): RunCommunicationReconcileResult {
	return {
		...result,
		runtimeDiagnostics: Object.freeze([...runtimeDiagnostics]),
	};
}

function emptyResult(
	mode: "check" | "dispatch",
	runtimeDiagnostics: readonly CommunicationRuntimeDiagnostic[],
): RunCommunicationReconcileResult {
	return {
		mode,
		intentIds: [],
		counts: {
			planned: 0,
			due: 0,
			alreadyRecorded: 0,
			reserved: 0,
			dispatched: 0,
			accepted: 0,
			uncertain: 0,
			rejected: 0,
			deferred: 0,
		},
		diagnostics: [],
		runtimeDiagnostics: Object.freeze([...runtimeDiagnostics]),
	};
}
