import type { MailMessageIntent } from "@meetup-automation/communication";
import { describe, expect, it, vi } from "vitest";
import { GithubRepositoryDispatchMailGateway } from "../src/index.js";

describe("GithubRepositoryDispatchMailGateway", () => {
	it("passes the PII-free idempotency key to the downstream deduplicator", async () => {
		const createDispatchEvent = vi.fn().mockResolvedValue({ status: 204 });
		const gateway = new GithubRepositoryDispatchMailGateway(
			{ createDispatchEvent },
			"example/mailings",
		);
		const intent = {
			channel: "mail",
			intentId: "intent-1",
			idempotencyKey: "meetup-v1-key",
			repositoryId: "repository-1",
			eventId: "event-1",
			policyVersion: "1",
			kind: "host-introduction",
			recipientId: "contact-1",
			recipient: {
				channel: "mail",
				role: "hosting",
				recipientId: "contact-1",
				receivesCommunications: true,
				email: "recipient@example.invalid",
			},
			templateName: "meetup-intro-hosting",
			placeholders: { eventDate: "2026-09-10" },
		} satisfies MailMessageIntent;

		await expect(gateway.dispatch(intent)).resolves.toEqual({
			outcome: "accepted",
		});
		expect(createDispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				client_payload: expect.objectContaining({
					"idempotency-key": "meetup-v1-key",
				}),
			}),
		);
	});

	it.each([
		[401, "authentication-failed"],
		[403, "permission-denied"],
		[404, "destination-unavailable"],
		[422, "invalid-request"],
	] as const)("classifies HTTP %s as a definitive rejection", async (status, code) => {
		const createDispatchEvent = vi.fn().mockRejectedValue({ status });
		const gateway = new GithubRepositoryDispatchMailGateway(
			{ createDispatchEvent },
			"example/mailings",
		);

		await expect(gateway.dispatch(mailIntent())).resolves.toEqual({
			outcome: "rejected",
			diagnosticCode: code,
		});
	});

	it("keeps failures without a definitive provider response uncertain", async () => {
		const gateway = new GithubRepositoryDispatchMailGateway(
			{ createDispatchEvent: vi.fn().mockRejectedValue(new Error("network")) },
			"example/mailings",
		);
		await expect(gateway.dispatch(mailIntent())).resolves.toEqual({
			outcome: "uncertain",
			diagnosticCode: "unknown-provider-state",
		});
	});

	it("classifies rate limiting as safely retryable", async () => {
		const gateway = new GithubRepositoryDispatchMailGateway(
			{ createDispatchEvent: vi.fn().mockRejectedValue({ status: 429 }) },
			"example/mailings",
		);
		await expect(gateway.dispatch(mailIntent())).resolves.toEqual({
			outcome: "deferred",
			diagnosticCode: "rate-limited",
		});
	});

	it.each([
		{ response: { headers: { "retry-after": "60" } }, status: 403 },
		{
			response: { headers: { "X-RateLimit-Remaining": "0" } },
			status: 403,
		},
	] as const)("classifies a GitHub 403 with rate-limit headers as safely retryable", async (failure) => {
		const gateway = new GithubRepositoryDispatchMailGateway(
			{ createDispatchEvent: vi.fn().mockRejectedValue(failure) },
			"example/mailings",
		);

		await expect(gateway.dispatch(mailIntent())).resolves.toEqual({
			outcome: "deferred",
			diagnosticCode: "rate-limited",
		});
	});

	it("does not infer rate limiting from an untrusted 403 header value", async () => {
		const gateway = new GithubRepositoryDispatchMailGateway(
			{
				createDispatchEvent: vi.fn().mockRejectedValue({
					response: { headers: { "retry-after": "recipient@example.test" } },
					status: 403,
				}),
			},
			"example/mailings",
		);

		await expect(gateway.dispatch(mailIntent())).resolves.toEqual({
			outcome: "rejected",
			diagnosticCode: "permission-denied",
		});
	});
});

function mailIntent(): MailMessageIntent {
	return {
		channel: "mail",
		intentId: "intent-1",
		idempotencyKey: "meetup-v1-key",
		repositoryId: "repository-1",
		eventId: "event-1",
		policyVersion: "1",
		kind: "host-introduction",
		recipientId: "contact-1",
		recipient: {
			channel: "mail",
			role: "hosting",
			recipientId: "contact-1",
			receivesCommunications: true,
			email: "recipient@example.invalid",
		},
		templateName: "meetup-intro-hosting",
		placeholders: { eventDate: "2026-09-10" },
	};
}
