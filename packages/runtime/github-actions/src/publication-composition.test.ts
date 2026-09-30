import { getOctokit } from "@actions/github";
import type { EventRepository } from "@meetup-automation/event";
import { ManageMeetupAssets } from "@meetup-automation/journey";
import type { AssetRepository } from "@meetup-automation/publication";
import { describe, expect, it, vi } from "vitest";
import { SERVICES } from "./composition.js";
import {
	ASSET_REPOSITORY,
	PublicationComposition,
} from "./publication-composition.js";

const input = {
	client: getOctokit("synthetic-test-token"),
	owner: "community",
	repo: "meetups",
	commentAuthorLogin: "automation[bot]",
	workspaceRoot: "/must-not-read",
};

const identity = { repository: "community/meetups", issueNumber: 42 };

function unrelatedEventRepository(): EventRepository {
	return {
		find: vi.fn().mockResolvedValue({
			identity,
			issueTitle: "Unrelated",
			issueState: "open",
			body: "",
			labels: [],
		}),
		listPage: vi.fn(),
		applyPatch: vi.fn(),
	};
}

describe("publication-composition", () => {
	it("allows replacing Drive before resolving the asset journey", async () => {
		// Arrange
		const container = PublicationComposition.createPublicationContainer({
			...input,
			credentials: "not-json",
			parentFolderId: "parent",
			templateFolderId: "templates",
		});
		const assets: AssetRepository = {
			findContainer: vi.fn(),
			ensureContainer: vi.fn(),
			listTemplates: vi.fn(),
			listFiles: vi.fn(),
			copyTemplate: vi.fn(),
			updateFile: vi.fn(),
		};
		container.rebind<AssetRepository>(ASSET_REPOSITORY).toConstantValue(assets);
		container
			.rebind<EventRepository>(SERVICES.eventRepository)
			.toConstantValue(unrelatedEventRepository());

		// Act
		const result = await container
			.get(ManageMeetupAssets)
			.execute({ identity });

		// Assert
		expect(result).toMatchObject({ skipped: true, persisted: false });
		expect(assets.ensureContainer).not.toHaveBeenCalled();
	});
});
