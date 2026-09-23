import { describe, expect, it, vi } from "vitest";
import { KuttFeedbackLinkGateway } from "./kutt-feedback-link-gateway.js";

const link = {
	id: "link-123",
	address: "community-feedback",
	link: "https://kutt.it/community-feedback",
	target: "https://openfeedback.io/old",
};
const target = "https://openfeedback.io/new";

describe("Kutt feedback link updates", () => {
	it.each([
		["", "link-123"],
		["   ", "link-123"],
		["synthetic-key", ""],
		["synthetic-key", "   "],
		["synthetic-key", "https://kutt.it/community-feedback"],
	])("rejects missing or invalid configuration (%j, %j)", (key, id) => {
		// Arrange
		const fetcher = vi.fn<typeof fetch>();

		// Act
		const createGateway = () => new KuttFeedbackLinkGateway(key, id, fetcher);

		// Assert
		expect(createGateway).toThrow(
			"Kutt API key and existing link ID are required",
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("finds the existing ID beyond the first page and preserves its short address", async () => {
		// Arrange
		const firstPage = Array.from({ length: 100 }, (_, i) => ({
			...link,
			id: `other-${i}`,
		}));
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(Response.json({ total: 101, data: firstPage }))
			.mockResolvedValueOnce(Response.json({ total: 101, data: [link] }))
			.mockResolvedValueOnce(Response.json({ ...link, target }));
		const gateway = new KuttFeedbackLinkGateway(
			"synthetic-key",
			link.id,
			fetcher,
		);

		// Act
		const result = await gateway.updateTarget(target);
		const body = JSON.parse(fetcher.mock.calls[2][1]?.body as string);

		// Assert
		expect(result).toBe(true);
		expect(fetcher.mock.calls[1][0]).toBe(
			"https://kutt.it/api/v2/links?limit=100&skip=100",
		);
		expect(fetcher.mock.calls[2]).toEqual([
			"https://kutt.it/api/v2/links/link-123",
			expect.objectContaining({
				method: "PATCH",
				redirect: "error",
				headers: {
					"X-API-KEY": "synthetic-key",
					"Content-Type": "application/json",
				},
			}),
		]);
		expect(body).toEqual({ target, address: link.address });
	});

	it("does not patch an already correct target", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				Response.json({ total: 1, data: [{ ...link, target }] }),
			);
		const gateway = new KuttFeedbackLinkGateway(
			"synthetic-key",
			link.id,
			fetcher,
		);

		// Act
		const result = await gateway.updateTarget(target);

		// Assert
		expect(result).toBe(false);
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it("does not create a missing short link", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ total: 0, data: [] }));
		const gateway = new KuttFeedbackLinkGateway(
			"synthetic-key",
			link.id,
			fetcher,
		);

		// Act
		const operation = gateway.updateTarget(target);

		// Assert
		await expect(operation).rejects.toThrow("not found");
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it.each([401, 429, 500])("redacts HTTP %s failures", async (status) => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response("private-response synthetic-key", { status }),
			);
		const gateway = new KuttFeedbackLinkGateway(
			"synthetic-key",
			link.id,
			fetcher,
		);

		// Act
		const operation = gateway.updateTarget(target);

		// Assert
		await expect(operation).rejects.toThrow(
			`Kutt request failed (HTTP ${status})`,
		);
	});

	it("redacts network errors", async () => {
		// Arrange
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new Error("synthetic-key"));
		const gateway = new KuttFeedbackLinkGateway(
			"synthetic-key",
			link.id,
			fetcher,
		);

		// Act
		const operation = gateway.updateTarget(target);

		// Assert
		await expect(operation).rejects.toThrow(/^Kutt request failed$/);
	});
});
