import type { NotificationMessageIntent } from "@meetup-automation/communication";
import { describe, expect, it, vi } from "vitest";
import { SlackNotificationGateway } from "../src/index.js";

const intent = {
	channel: "notification",
	intentId: "intent-1",
	idempotencyKey: "meetup-v1-key",
	repositoryId: "repository-1",
	eventId: "event-1",
	policyVersion: "1",
	kind: "readiness-reminder",
	recipientId: "organizers",
	recipient: {
		channel: "notification",
		role: "organizers",
		recipientId: "organizers",
		receivesCommunications: true,
		destination: "channel-1",
	},
	content: "Event requires attention",
} satisfies NotificationMessageIntent;

describe("SlackNotificationGateway", () => {
	it("posts only the documented channel and text fields", async () => {
		const fetcher = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true }),
		});
		const gateway = new SlackNotificationGateway("token", fetcher);

		await expect(gateway.dispatch(intent)).resolves.toEqual({
			outcome: "accepted",
		});
		expect(fetcher).toHaveBeenCalledWith(
			"https://slack.com/api/chat.postMessage",
			expect.objectContaining({
				body: JSON.stringify({
					channel: "channel-1",
					text: "Event requires attention",
				}),
			}),
		);
	});

	it("does not attempt delivery without a configured token", async () => {
		const fetcher = vi.fn();
		await expect(
			new SlackNotificationGateway("", fetcher).dispatch(intent),
		).resolves.toEqual({
			outcome: "rejected",
			diagnosticCode: "authentication-failed",
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it.each([
		["invalid_auth", "authentication-failed"],
		["channel_not_found", "destination-unavailable"],
		["missing_scope", "permission-denied"],
		["invalid_arguments", "invalid-request"],
	] as const)("classifies Slack %s as a definitive rejection", async (error, code) => {
		const fetcher = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: false, error }),
		});

		await expect(
			new SlackNotificationGateway("token", fetcher).dispatch(intent),
		).resolves.toEqual({ outcome: "rejected", diagnosticCode: code });
	});

	it("keeps transport failures and unknown responses uncertain", async () => {
		const transportFailure = vi
			.fn()
			.mockRejectedValue(new Error("socket reset"));
		await expect(
			new SlackNotificationGateway("token", transportFailure).dispatch(intent),
		).resolves.toEqual({
			outcome: "uncertain",
			diagnosticCode: "unknown-provider-state",
		});

		const unknownResponse = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: false, error: "future_error" }),
		});
		await expect(
			new SlackNotificationGateway("token", unknownResponse).dispatch(intent),
		).resolves.toEqual({
			outcome: "uncertain",
			diagnosticCode: "ambiguous-response",
		});
	});

	it("classifies Slack rate limiting as safely retryable", async () => {
		const fetcher = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: false, error: "ratelimited" }),
		});
		await expect(
			new SlackNotificationGateway("token", fetcher).dispatch(intent),
		).resolves.toEqual({
			outcome: "deferred",
			diagnosticCode: "rate-limited",
		});
	});
});
