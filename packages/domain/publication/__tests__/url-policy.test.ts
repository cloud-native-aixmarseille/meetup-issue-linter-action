import { describe, expect, it } from "vitest";
import {
	createDefaultPublicationUrlPolicies,
	PublicationUrlPolicyEngine,
} from "../src/index.js";

describe("publication URL policies", () => {
	it("accepts canonical provider references", () => {
		const engine = new PublicationUrlPolicyEngine(
			createDefaultPublicationUrlPolicies(),
		);
		const result = engine.evaluate({
			meetup:
				"https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
			community:
				"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/cloud-native-evening",
			assets: "https://drive.google.com/drive/folders/abc_DEF-123",
		});

		expect(result.diagnostics).toEqual([]);
		expect(result.patch.operations).toEqual([]);
	});

	it("accepts the legacy CNCF community URL", () => {
		const result = new PublicationUrlPolicyEngine(
			createDefaultPublicationUrlPolicies(),
		).evaluate({
			community:
				"https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-platform-engineering",
		});

		expect(result.diagnostics).toEqual([]);
	});

	it("normalizes outer whitespace and trailing slashes immutably", () => {
		const source = {
			meetup:
				" https://www.meetup.com/cloud-native-aix-marseille/events/123456789/ ",
		};
		const result = new PublicationUrlPolicyEngine(
			createDefaultPublicationUrlPolicies(),
		).evaluate(source);

		expect(source.meetup).toBe(
			" https://www.meetup.com/cloud-native-aix-marseille/events/123456789/ ",
		);
		expect(result.references.meetup).toBe(
			"https://www.meetup.com/cloud-native-aix-marseille/events/123456789",
		);
		expect(result.patch.operations).toHaveLength(1);
		expect(result.diagnostics[0]).toMatchObject({
			code: "publication.meetup.normalized",
			fixAvailable: true,
		});
	});

	it.each([
		[
			"meetup",
			"https://www.meetup.com/cloud-native-aix-marseille/events/not-numeric",
			"publication.meetup-url.invalid",
		],
		[
			"community",
			"https://example.com/community/event",
			"publication.community-url.invalid",
		],
		[
			"assets",
			"http://drive.google.com/drive/folders/abc",
			"publication.asset-url.invalid",
		],
	] as const)("rejects invalid %s references", (field, value, expectedCode) => {
		const result = new PublicationUrlPolicyEngine(
			createDefaultPublicationUrlPolicies(),
		).evaluate({ [field]: value });

		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				code: expectedCode,
				field,
				severity: "error",
			}),
		);
		expect(result.patch.operations).toEqual([]);
	});
});
