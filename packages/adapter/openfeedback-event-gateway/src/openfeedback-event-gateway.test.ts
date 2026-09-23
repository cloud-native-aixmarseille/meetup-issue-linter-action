import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenFeedbackEventGateway } from "./openfeedback-event-gateway.js";

const apiKey = "oforg_synthetic-key";
const input = {
	key: "demo/community#42",
	name: "Cloud meetup in October",
	scheduleUrl: "https://github.com/demo/community/issues/42",
};
const eventId =
	"meetup-fba675e31b0177edf4b9b1070012a46bdc5ac1582929a3bc0c45b9e9dfd719e6";

afterEach(() => vi.restoreAllMocks());

describe("OpenFeedback event creation", () => {
	it.each(["", "   ", "ofproj_synthetic-key", "oforg_", "oforg_ "])(
		"rejects a missing or non-organization API key (%j)",
		(key) => {
			// Arrange
			const fetcher = vi.fn<typeof fetch>();

			// Act
			const createGateway = () => new OpenFeedbackEventGateway(key, fetcher);

			// Assert
			expect(createGateway).toThrow(
				"An OpenFeedback organization API key is required",
			);
			expect(fetcher).not.toHaveBeenCalled();
		},
	);

	it.each([
		{ key: "" },
		{ key: "   " },
		{ name: "" },
		{ name: "   " },
		{ name: "x".repeat(101) },
	])("rejects invalid event identity or name (%j)", async (changes) => {
		// Arrange
		const fetcher = vi.fn<typeof fetch>();
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const operation = gateway.ensureEvent({ ...input, ...changes });

		// Assert
		await expect(operation).rejects.toThrow(
			"Invalid OpenFeedback event identity or name",
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it.each([
		"",
		"not a URL",
		"http://github.com/demo/community/issues/42",
		"https://user:password@github.com/demo/community/issues/42",
	])("rejects an invalid schedule URL (%j)", async (scheduleUrl) => {
		// Arrange
		const fetcher = vi.fn<typeof fetch>();
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const operation = gateway.ensureEvent({ ...input, scheduleUrl });

		// Assert
		await expect(operation).rejects.toThrow(
			"Invalid OpenFeedback event schedule URL",
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("creates a deterministic event while inheriting organization settings", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ id: eventId }, { status: 201 }));
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const result = await gateway.ensureEvent(input);
		const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);

		// Assert
		expect(result).toBe(`https://openfeedback.io/${eventId}`);
		expect(fetcher).toHaveBeenCalledExactlyOnceWith(
			"https://api.openfeedback.io/events/",
			expect.objectContaining({
				method: "POST",
				redirect: "error",
				signal: expect.any(AbortSignal),
				headers: {
					"x-api-key": apiKey,
					"Content-Type": "application/json",
				},
			}),
		);
		expect(body).toEqual({
			id: eventId,
			name: input.name,
			scheduleLink: input.scheduleUrl,
			setupType: "openfeedbackv1",
		});
	});

	it("reuses the event identity after metadata changes and updates only its name and schedule", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(Response.json({ id: eventId }, { status: 201 }))
			.mockResolvedValueOnce(new Response("already exists", { status: 409 }))
			.mockResolvedValueOnce(Response.json({ id: eventId }));
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);
		const revised = { ...input, name: "Revised meetup title" };

		// Act
		const first = await gateway.ensureEvent(input);
		const second = await gateway.ensureEvent(revised);
		const creation = JSON.parse(fetcher.mock.calls[1][1]?.body as string);
		const update = JSON.parse(fetcher.mock.calls[2][1]?.body as string);

		// Assert
		expect(second).toBe(first);
		expect(creation.id).toBe(eventId);
		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(fetcher.mock.calls[2]).toEqual([
			`https://api.openfeedback.io/events/${eventId}`,
			expect.objectContaining({
				method: "PATCH",
				redirect: "error",
				headers: {
					"x-api-key": apiKey,
					"Content-Type": "application/json",
				},
			}),
		]);
		expect(update).toEqual({
			name: revised.name,
			scheduleLink: revised.scheduleUrl,
		});
	});

	it("recovers the same event after the creation response is lost", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValueOnce(new Error("Connection lost after creation"))
			.mockResolvedValueOnce(new Response("exists", { status: 409 }))
			.mockResolvedValueOnce(Response.json({ id: eventId }));
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const firstError = await gateway
			.ensureEvent(input)
			.catch((error: unknown) => error);
		const recovered = await gateway.ensureEvent(input);
		const originalBody = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
		const retriedBody = JSON.parse(fetcher.mock.calls[1][1]?.body as string);

		// Assert
		expect(firstError).toMatchObject({
			message: "OpenFeedback request failed",
		});
		expect(recovered).toBe(`https://openfeedback.io/${eventId}`);
		expect(retriedBody.id).toBe(originalBody.id);
		expect(fetcher.mock.calls[2][0]).toBe(
			`https://api.openfeedback.io/events/${eventId}`,
		);
		expect(fetcher.mock.calls[2][1]?.method).toBe("PATCH");
	});

	it("gives different event keys different identities", async () => {
		// Arrange
		const otherId =
			"meetup-5b2ba1a4031dd03cda721bac81182a8f4033364a55d5f5d1bbcd6b2007991750";
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(Response.json({ id: eventId }, { status: 201 }))
			.mockResolvedValueOnce(Response.json({ id: otherId }, { status: 201 }));
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const first = await gateway.ensureEvent(input);
		const second = await gateway.ensureEvent({
			...input,
			key: "demo/community#43",
		});

		// Assert
		expect(first).toBe(`https://openfeedback.io/${eventId}`);
		expect(second).toBe(`https://openfeedback.io/${otherId}`);
	});

	it.each([401, 403, 404])(
		"does not recover a conflicting event without authorized access (HTTP %s)",
		async (status) => {
			// Arrange
			const fetcher = vi
				.fn<typeof fetch>()
				.mockResolvedValueOnce(new Response("exists", { status: 409 }))
				.mockResolvedValueOnce(
					new Response(`private-response ${apiKey}`, { status }),
				);
			const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

			// Act
			const operation = gateway.ensureEvent(input);

			// Assert
			await expect(operation).rejects.toThrow(
				`OpenFeedback request failed (HTTP ${status})`,
			);
			expect(fetcher).toHaveBeenCalledTimes(2);
		},
	);

	it.each([400, 401, 403, 429, 500])(
		"redacts failed creation responses without retrying (HTTP %s)",
		async (status) => {
			// Arrange
			const fetcher = vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					new Response(`private-response ${apiKey}`, { status }),
				);
			const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

			// Act
			const operation = gateway.ensureEvent(input);

			// Assert
			await expect(operation).rejects.toThrow(
				`OpenFeedback request failed (HTTP ${status})`,
			);
			expect(fetcher).toHaveBeenCalledOnce();
		},
	);

	it.each([null, [], "private-response", {}, { id: "other-event" }])(
		"rejects an unexpected event response (%j)",
		async (body) => {
			// Arrange
			const fetcher = vi
				.fn<typeof fetch>()
				.mockResolvedValue(Response.json(body));
			const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

			// Act
			const operation = gateway.ensureEvent(input);

			// Assert
			await expect(operation).rejects.toThrow(
				"OpenFeedback returned an unexpected event",
			);
		},
	);

	it("rejects recovery responses for a different event", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response("exists", { status: 409 }))
			.mockResolvedValueOnce(Response.json({ id: "other-event" }));
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const operation = gateway.ensureEvent(input);

		// Assert
		await expect(operation).rejects.toThrow(
			"OpenFeedback returned an unexpected event",
		);
	});

	it("redacts malformed JSON responses", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(`private-response ${apiKey}`));
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const operation = gateway.ensureEvent(input);

		// Assert
		await expect(operation).rejects.toThrow(
			"Invalid OpenFeedback JSON response",
		);
	});

	it("redacts network errors", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new Error(`private-response ${apiKey}`));
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const operation = gateway.ensureEvent(input);

		// Assert
		await expect(operation).rejects.toThrow(/^OpenFeedback request failed$/);
	});

	it("bounds requests to thirty seconds and redacts timeout errors", async () => {
		// Arrange
		const signal = AbortSignal.abort(new Error(`private-response ${apiKey}`));
		const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
		const fetcher = vi
			.fn<typeof fetch>()
			.mockImplementation(async (_, init) => {
				init?.signal?.throwIfAborted();
				return Response.json({ id: eventId });
			});
		const gateway = new OpenFeedbackEventGateway(apiKey, fetcher);

		// Act
		const operation = gateway.ensureEvent(input);

		// Assert
		await expect(operation).rejects.toThrow(/^OpenFeedback request failed$/);
		expect(timeout).toHaveBeenCalledExactlyOnceWith(30_000);
		expect(fetcher.mock.calls[0][1]?.signal).toBe(signal);
	});
});
