import { createHash } from "node:crypto";
import type { FeedbackEventGateway } from "@meetup-automation/publication";

export class OpenFeedbackEventGateway implements FeedbackEventGateway {
	constructor(
		private readonly apiKey: string,
		private readonly fetcher: typeof fetch = fetch,
	) {
		if (!/^oforg_\S+$/.test(apiKey))
			throw new Error("An OpenFeedback organization API key is required");
	}

	async ensureEvent(input: {
		readonly key: string;
		readonly name: string;
		readonly scheduleUrl: string;
	}): Promise<string> {
		OpenFeedbackEventGateway.validateInput(input);
		const id = `meetup-${createHash("sha256").update(input.key).digest("hex")}`;
		const details = { name: input.name, scheduleLink: input.scheduleUrl };
		let response = await this.request("/events/", "POST", {
			id,
			...details,
			setupType: "openfeedbackv1",
		});
		if (response.status === 409) {
			// PATCH verifies organization access and preserves all omitted settings.
			response = await this.request(`/events/${id}`, "PATCH", details);
		}
		await OpenFeedbackEventGateway.validateResponse(response, id);
		return `https://openfeedback.io/${id}`;
	}

	private static validateInput(input: {
		readonly key: string;
		readonly name: string;
		readonly scheduleUrl: string;
	}): void {
		if (!input.key.trim() || !input.name.trim() || input.name.length > 100)
			throw new Error("Invalid OpenFeedback event identity or name");
		let scheduleUrl: URL;
		try {
			scheduleUrl = new URL(input.scheduleUrl);
		} catch {
			throw new Error("Invalid OpenFeedback event schedule URL");
		}
		if (
			scheduleUrl.protocol !== "https:" ||
			scheduleUrl.username ||
			scheduleUrl.password
		)
			throw new Error("Invalid OpenFeedback event schedule URL");
	}

	private async request(
		path: string,
		method: "POST" | "PATCH",
		body: Readonly<Record<string, string>>,
	): Promise<Response> {
		try {
			return await this.fetcher(`https://api.openfeedback.io${path}`, {
				method,
				body: JSON.stringify(body),
				redirect: "error",
				signal: AbortSignal.timeout(30_000),
				headers: {
					"x-api-key": this.apiKey,
					"Content-Type": "application/json",
				},
			});
		} catch {
			throw new Error("OpenFeedback request failed");
		}
	}

	private static async validateResponse(
		response: Response,
		id: string,
	): Promise<void> {
		if (!response.ok)
			throw new Error(`OpenFeedback request failed (HTTP ${response.status})`);
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			throw new Error("Invalid OpenFeedback JSON response");
		}
		if (
			!body ||
			typeof body !== "object" ||
			Array.isArray(body) ||
			!("id" in body) ||
			body.id !== id
		)
			throw new Error("OpenFeedback returned an unexpected event");
	}
}
