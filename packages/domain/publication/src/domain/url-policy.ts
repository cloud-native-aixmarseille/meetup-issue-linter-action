import {
	applyPublicationPatch,
	type PublicationDiagnostic,
	type PublicationEvaluation,
	type PublicationPatchOperation,
	type PublicationReferences,
} from "./model.js";

export type PublicationUrlConfiguration = Readonly<{
	meetupEventUrlPrefix: string;
	communityEventUrlPrefixes: readonly string[];
	assetFolderUrlPrefix: string;
}>;

export const DEFAULT_PUBLICATION_URL_CONFIGURATION: PublicationUrlConfiguration =
	Object.freeze({
		meetupEventUrlPrefix:
			"https://www.meetup.com/cloud-native-aix-marseille/events/",
		communityEventUrlPrefixes: Object.freeze([
			"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/",
			"https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-",
		]),
		assetFolderUrlPrefix: "https://drive.google.com/drive/folders/",
	});

export interface PublicationUrlPolicy {
	readonly id: string;
	evaluate(references: PublicationReferences): PublicationEvaluation;
}

export class MeetupEventUrlPolicy implements PublicationUrlPolicy {
	readonly id = "meetup-event-url";

	constructor(private readonly prefix: string) {}

	evaluate(references: PublicationReferences): PublicationEvaluation {
		return evaluateLink({
			references,
			path: "meetup",
			prefixes: [this.prefix],
			identifierPattern: /^\d+$/,
			code: "publication.meetup-url.invalid",
			message: `Meetup URL must start with ${this.prefix} and end with a numeric event identifier`,
		});
	}
}

export class CommunityEventUrlPolicy implements PublicationUrlPolicy {
	readonly id = "community-event-url";

	constructor(private readonly prefixes: readonly string[]) {}

	evaluate(references: PublicationReferences): PublicationEvaluation {
		return evaluateLink({
			references,
			path: "community",
			prefixes: this.prefixes,
			identifierPattern: /^[0-9a-z-]+$/,
			code: "publication.community-url.invalid",
			message:
				"Community event URL must use an approved CNCF/OCGroups prefix and identifier",
		});
	}
}

export class AssetFolderUrlPolicy implements PublicationUrlPolicy {
	readonly id = "asset-folder-url";

	constructor(private readonly prefix: string) {}

	evaluate(references: PublicationReferences): PublicationEvaluation {
		return evaluateLink({
			references,
			path: "assets",
			prefixes: [this.prefix],
			identifierPattern: /^[a-zA-Z0-9_-]+$/,
			code: "publication.asset-url.invalid",
			message: `Asset folder URL must start with ${this.prefix} and end with a folder identifier`,
		});
	}
}

export class PublicationUrlPolicyEngine {
	constructor(private readonly policies: readonly PublicationUrlPolicy[]) {}

	evaluate(references: PublicationReferences): PublicationEvaluation {
		let normalized = references;
		const diagnostics: PublicationDiagnostic[] = [];
		const operations: PublicationPatchOperation[] = [];

		for (const policy of this.policies) {
			const result = policy.evaluate(normalized);
			diagnostics.push(...result.diagnostics);
			operations.push(...result.patch.operations);
			normalized = applyPublicationPatch(normalized, result.patch);
		}

		return {
			references: normalized,
			diagnostics: Object.freeze(diagnostics),
			patch: Object.freeze({ operations: Object.freeze(operations) }),
		};
	}
}

export function createDefaultPublicationUrlPolicies(
	configuration: PublicationUrlConfiguration = DEFAULT_PUBLICATION_URL_CONFIGURATION,
): readonly PublicationUrlPolicy[] {
	return Object.freeze([
		new MeetupEventUrlPolicy(configuration.meetupEventUrlPrefix),
		new CommunityEventUrlPolicy(configuration.communityEventUrlPrefixes),
		new AssetFolderUrlPolicy(configuration.assetFolderUrlPrefix),
	]);
}

type EvaluateLinkInput<P extends keyof PublicationReferences> = Readonly<{
	references: PublicationReferences;
	path: P;
	prefixes: readonly string[];
	identifierPattern: RegExp;
	code: string;
	message: string;
}>;

function evaluateLink<P extends keyof PublicationReferences>({
	references,
	path,
	prefixes,
	identifierPattern,
	code,
	message,
}: EvaluateLinkInput<P>): PublicationEvaluation {
	const raw = references[path];
	if (raw === undefined || raw === "") {
		return emptyEvaluation(references);
	}

	const normalized = raw.trim().replace(/\/$/, "");
	const matchingPrefix = prefixes.find((prefix) =>
		normalized.startsWith(prefix),
	);
	const identifier = matchingPrefix
		? normalized.slice(matchingPrefix.length)
		: undefined;

	if (
		!isHttpsUrl(normalized) ||
		!matchingPrefix ||
		!identifier ||
		!identifierPattern.test(identifier)
	) {
		return {
			references,
			diagnostics: [
				Object.freeze({
					code,
					severity: "error" as const,
					field: path,
					message,
				}),
			],
			patch: Object.freeze({ operations: [] }),
		};
	}

	if (raw === normalized) {
		return emptyEvaluation(references);
	}

	const operation = Object.freeze({
		op: "replace" as const,
		path,
		value: normalized,
		reason: "Trim URL and remove its trailing slash",
	}) as PublicationPatchOperation;

	return {
		references: { ...references, [path]: normalized },
		diagnostics: [
			Object.freeze({
				code: `publication.${path}.normalized`,
				severity: "info" as const,
				field: path,
				message: `${path} URL can be normalized safely`,
				fixAvailable: true,
			}),
		],
		patch: Object.freeze({ operations: Object.freeze([operation]) }),
	};
}

function emptyEvaluation(
	references: PublicationReferences,
): PublicationEvaluation {
	return {
		references,
		diagnostics: [],
		patch: Object.freeze({ operations: [] }),
	};
}

function isHttpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}
