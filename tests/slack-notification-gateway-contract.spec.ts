import { describe, expect, it, vi } from "vitest";
import { SlackNotificationGateway } from "../packages/adapter/slack-notification-gateway/src/index.js";
import type { NotificationMessageIntent } from "../packages/domain/communication/src/index.js";

const intent = {
	channel: "notification",
	intentId: "intent-safe",
	idempotencyKey: "meetup-safe-key",
	repositoryId: "repository-safe",
	eventId: "event-safe",
	policyVersion: "1",
	kind: "readiness-reminder",
	recipientId: "organizers",
	recipient: {
		channel: "notification",
		role: "organizers",
		recipientId: "organizers",
		receivesCommunications: true,
		destination: "channel-safe",
	},
	content: "A meetup event requires attention.",
} satisfies NotificationMessageIntent;

describe("Slack notification failure contract", () => {
	it.each([
		[400, "rejected", "invalid-request"],
		[422, "rejected", "invalid-request"],
		[401, "rejected", "authentication-failed"],
		[403, "rejected", "permission-denied"],
		[404, "rejected", "destination-unavailable"],
		[429, "deferred", "rate-limited"],
		[500, "uncertain", "ambiguous-response"],
	] as const)("maps HTTP %s without exposing the provider body", async (status, outcome, diagnosticCode) => {
		const fetcher = vi.fn().mockResolvedValue({ ok: false, status });
		const result = await new SlackNotificationGateway(
			"synthetic-token",
			fetcher,
		).dispatch(intent);

		expect(result).toEqual({ outcome, diagnosticCode });
	});

	it("treats malformed success bodies as ambiguous", async () => {
		const invalidJson = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
		});
		await expect(
			new SlackNotificationGateway("synthetic-token", invalidJson).dispatch(
				intent,
			),
		).resolves.toEqual({
			outcome: "uncertain",
			diagnosticCode: "ambiguous-response",
		});

		const invalidError = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ ok: false, error: { private: true } }),
		});
		await expect(
			new SlackNotificationGateway("synthetic-token", invalidError).dispatch(
				intent,
			),
		).resolves.toEqual({
			outcome: "uncertain",
			diagnosticCode: "ambiguous-response",
		});
	});
});
