import type {
	GatewayDispatchResult,
	MailGateway,
	MailMessageIntent,
} from "@meetup-automation/communication";

export interface RepositoryDispatchClient {
	createDispatchEvent(input: {
		owner: string;
		repo: string;
		event_type: string;
		client_payload: Record<string, unknown>;
	}): Promise<unknown>;
}

export class GithubRepositoryDispatchMailGateway implements MailGateway {
	readonly #owner: string;
	readonly #repository: string;

	constructor(
		private readonly client: RepositoryDispatchClient,
		repository: string,
	) {
		const [owner, name, ...extra] = repository.split("/");
		if (!owner || !name || extra.length > 0) {
			throw new Error("Mailings repository must use owner/repository format");
		}
		this.#owner = owner;
		this.#repository = name;
	}

	async dispatch(message: MailMessageIntent): Promise<GatewayDispatchResult> {
		try {
			await this.client.createDispatchEvent({
				owner: this.#owner,
				repo: this.#repository,
				event_type: "send-transactional-email",
				client_payload: {
					"idempotency-key": message.idempotencyKey,
					"template-name": message.templateName,
					"to-email": message.recipient.email,
					placeholders: message.placeholders,
				},
			});
		} catch (error) {
			return classifyFailure(error);
		}
		return { outcome: "accepted" };
	}
}

function classifyFailure(error: unknown): GatewayDispatchResult {
	const status = responseStatus(error);
	if (isRateLimited(error, status)) {
		return { outcome: "deferred", diagnosticCode: "rate-limited" };
	}
	switch (status) {
		case 400:
		case 422:
			return { outcome: "rejected", diagnosticCode: "invalid-request" };
		case 401:
			return { outcome: "rejected", diagnosticCode: "authentication-failed" };
		case 403:
			return { outcome: "rejected", diagnosticCode: "permission-denied" };
		case 404:
			return { outcome: "rejected", diagnosticCode: "destination-unavailable" };
		default:
			return { outcome: "uncertain", diagnosticCode: "unknown-provider-state" };
	}
}

function responseStatus(error: unknown): number | undefined {
	if (!isRecord(error)) return undefined;
	const direct = Number(error.status);
	if (Number.isInteger(direct)) return direct;
	if (!isRecord(error.response)) return undefined;
	const nested = Number(error.response.status);
	return Number.isInteger(nested) ? nested : undefined;
}

/**
 * GitHub can report both primary and secondary rate limits as HTTP 403. Only
 * documented response headers are inspected: exception messages and response
 * bodies may contain request or recipient data and must not cross this adapter.
 */
function isRateLimited(error: unknown, status: number | undefined): boolean {
	if (status === 429) return true;
	if (status !== 403) return false;

	const retryAfter = responseHeader(error, "retry-after");
	if (retryAfter !== undefined && /^\d+$/.test(retryAfter.trim())) {
		return true;
	}

	return responseHeader(error, "x-ratelimit-remaining")?.trim() === "0";
}

function responseHeader(error: unknown, name: string): string | undefined {
	if (!isRecord(error)) return undefined;
	const response = isRecord(error.response) ? error.response : undefined;
	const headers = isRecord(response?.headers)
		? response.headers
		: isRecord(error.headers)
			? error.headers
			: undefined;
	if (!headers) return undefined;

	const matchingKey = Object.keys(headers).find(
		(key) => key.toLowerCase() === name,
	);
	const value = matchingKey ? headers[matchingKey] : undefined;
	return typeof value === "string" || typeof value === "number"
		? String(value)
		: undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
