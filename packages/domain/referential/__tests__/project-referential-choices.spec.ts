import {
	ProjectReferentialChoices,
	ValidateReferentialCatalog,
} from "../src/index.js";
import {
	hostRecord,
	rawCatalog,
	speakerRecord,
} from "./referential.fixtures.js";

describe("ProjectReferentialChoices", () => {
	it("emits plain public names from a valid catalog", async () => {
		const validation = await new ValidateReferentialCatalog().execute(
			rawCatalog({
				hosts: [
					hostRecord(),
					hostRecord({
						hostId: "host-0002",
						displayName: "Other Host",
						contactId: "contact-0002",
					}),
					hostRecord({
						hostId: "host-0003",
						displayName: "Unique Host",
						contactId: "contact-0003",
					}),
				],
				speakers: [
					speakerRecord(),
					speakerRecord({
						speakerId: "speaker-0002",
						firstName: "Other",
					}),
					speakerRecord({
						speakerId: "speaker-0003",
						firstName: "Unique",
					}),
				],
			}),
		);
		if (!validation.isValid) {
			throw new Error("Fixture catalog must be valid");
		}

		const projection = new ProjectReferentialChoices().execute(
			validation.catalog,
		);

		expect(projection.hostOptions).toEqual([
			"Example Host",
			"Other Host",
			"Unique Host",
		]);
		expect(projection.speakerReferences).toEqual([
			"Example Speaker",
			"Other Speaker",
			"Unique Speaker",
		]);
		expect(Object.isFrozen(projection)).toBe(true);
		expect(Object.isFrozen(projection.hostOptions)).toBe(true);
		expect(JSON.stringify(projection)).not.toContain("@example.test");
		expect(JSON.stringify(projection)).not.toContain("Private Contact");
	});
});
