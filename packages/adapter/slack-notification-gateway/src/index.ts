import type {
	GatewayDispatchResult,
	NotificationGateway,
	NotificationMessageIntent,
} from "@meetup-automation/communication";

export type SlackFetch = typeof fetch;

export class SlackNotificationGateway implements NotificationGateway {
	constructor(
		private readonly token: string,
		private readonly fetcher: SlackFetch = fetch,
	) {}

	async dispatch(
		message: NotificationMessageIntent,
	): Promise<GatewayDispatchResult> {
		if (!this.token) {
			return { outcome: "rejected", diagnosticCode: "authentication-failed" };
		}

		let response: Response;
		try {
			response = await this.fetcher("https://slack.com/api/chat.postMessage", {
				method: "POST",
				headers: {
					authorization: `Bearer ${this.token}`,
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					channel: message.recipient.destination,
					text: message.content,
				}),
			});
		} catch {
			return { outcome: "uncertain", diagnosticCode: "unknown-provider-state" };
		}

		if (!response.ok) {
			const rejection = httpRejection(response.status);
			if (rejection) return rejection;
			return { outcome: "uncertain", diagnosticCode: "ambiguous-response" };
		}
		let payload: { ok?: boolean; error?: unknown };
		try {
			payload = (await response.json()) as { ok?: boolean; error?: unknown };
		} catch {
			return { outcome: "uncertain", diagnosticCode: "ambiguous-response" };
		}
		if (payload.ok) return { outcome: "accepted" };
		return slackApiRejection(payload.error);
	}
}

function httpRejection(status: number): GatewayDispatchResult | undefined {
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
		case 429:
			return { outcome: "deferred", diagnosticCode: "rate-limited" };
		default:
			return undefined;
	}
}

function slackApiRejection(error: unknown): GatewayDispatchResult {
	if (typeof error !== "string") {
		return { outcome: "uncertain", diagnosticCode: "ambiguous-response" };
	}
	if (
		[
			"invalid_auth",
			"not_authed",
			"account_inactive",
			"token_revoked",
		].includes(error)
	) {
		return { outcome: "rejected", diagnosticCode: "authentication-failed" };
	}
	if (["channel_not_found", "not_in_channel", "is_archived"].includes(error)) {
		return { outcome: "rejected", diagnosticCode: "destination-unavailable" };
	}
	if (["missing_scope", "restricted_action"].includes(error)) {
		return { outcome: "rejected", diagnosticCode: "permission-denied" };
	}
	if (
		[
			"invalid_arguments",
			"invalid_arg_name",
			"msg_too_long",
			"no_text",
		].includes(error)
	) {
		return { outcome: "rejected", diagnosticCode: "invalid-request" };
	}
	if (error === "ratelimited") {
		return { outcome: "deferred", diagnosticCode: "rate-limited" };
	}
	return { outcome: "uncertain", diagnosticCode: "ambiguous-response" };
}
