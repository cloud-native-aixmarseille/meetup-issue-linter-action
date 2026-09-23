import {
	type FeedbackLinkGateway,
	FeedbackPolicy,
} from "@meetup-automation/publication";

type KuttLink = { id: string; address: string; target: string; link: string };

export class KuttFeedbackLinkGateway implements FeedbackLinkGateway {
	constructor(
		private readonly apiKey: string,
		private readonly linkId: string,
		private readonly fetcher: typeof fetch = fetch,
	) {
		if (!apiKey.trim() || !/^[a-zA-Z0-9_-]+$/.test(linkId))
			throw new Error("Kutt API key and existing link ID are required");
	}

	async updateTarget(value: string): Promise<boolean> {
		const target = FeedbackPolicy.pollUrl(value);
		const link = await this.findLink();
		if (link.target === target) return false;
		const response = (await this.request(
			`/links/${encodeURIComponent(this.linkId)}`,
			{
				method: "PATCH",
				body: JSON.stringify({ target, address: link.address }),
			},
		)) as KuttLink;
		if (
			response.id !== link.id ||
			response.address !== link.address ||
			response.target !== target ||
			response.link !== link.link
		)
			throw new Error("Kutt returned an unexpected updated link");
		return true;
	}

	private async findLink(): Promise<KuttLink> {
		// Kutt v2 has no GET /links/{id}. Walk the owner's paginated list.
		for (let skip = 0; skip < 100_000; skip += 100) {
			const page = (await this.request(
				`/links?limit=100&skip=${skip}`,
				{},
			)) as { total: number; data: KuttLink[] };
			if (
				!Array.isArray(page.data) ||
				!Number.isSafeInteger(page.total) ||
				page.total < 0
			)
				throw new Error("Invalid Kutt link listing");
			const link = page.data.find((item) => item.id === this.linkId);
			if (link) {
				if (!link.address || !link.target || !link.link)
					throw new Error("Invalid Kutt link response");
				return link;
			}
			if (skip + page.data.length >= page.total) break;
			if (page.data.length !== 100)
				throw new Error("Incomplete Kutt link listing");
		}
		throw new Error("The configured Kutt link was not found");
	}

	private async request(path: string, init: RequestInit): Promise<unknown> {
		let response: Response;
		try {
			response = await this.fetcher(`https://kutt.it/api/v2${path}`, {
				...init,
				redirect: "error",
				signal: AbortSignal.timeout(30_000),
				headers: {
					"X-API-KEY": this.apiKey,
					"Content-Type": "application/json",
				},
			});
		} catch {
			throw new Error("Kutt request failed");
		}
		if (!response.ok)
			throw new Error(`Kutt request failed (HTTP ${response.status})`);
		try {
			return await response.json();
		} catch {
			throw new Error("Invalid Kutt JSON response");
		}
	}
}
