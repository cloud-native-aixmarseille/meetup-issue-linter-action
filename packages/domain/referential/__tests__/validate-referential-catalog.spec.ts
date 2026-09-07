import type { ReferentialRepository } from "../src/index.js";
import { ValidateReferentialCatalog } from "../src/index.js";
import {
	hostRecord,
	rawCatalog,
	speakerRecord,
} from "./referential.fixtures.js";

describe("ValidateReferentialCatalog", () => {
	it("normalizes records and groups multiple contacts under one immutable host", async () => {
		const result = await new ValidateReferentialCatalog().execute(
			rawCatalog({
				hosts: [
					hostRecord({
						displayName: "  Example   Host  ",
						contactName: "  First   Contact ",
						email: " FIRST@EXAMPLE.TEST ",
					}),
					hostRecord({
						contactId: "contact-0002",
						contactName: "Second Contact",
						email: "second@example.test",
					}),
				],
			}),
		);

		expect(result.isValid).toBe(true);
		if (!result.isValid) {
			return;
		}
		expect(result.catalog.hosts).toHaveLength(1);
		expect(result.catalog.hosts[0]).toMatchObject({
			id: "host-0001",
			displayName: "Example Host",
		});
		expect(result.catalog.hosts[0].contacts).toHaveLength(2);
		expect(result.catalog.hosts[0].contacts[0]).toMatchObject({
			name: "First Contact",
			email: "first@example.test",
		});
		expect(Object.isFrozen(result.catalog)).toBe(true);
		expect(Object.isFrozen(result.catalog.hosts[0])).toBe(true);
		expect(Object.isFrozen(result.catalog.hosts[0].contacts)).toBe(true);
		expect(Object.isFrozen(result.catalog.hosts[0].contacts[0])).toBe(true);
	});

	it("loads raw records through the narrow repository port", async () => {
		const repository: ReferentialRepository = {
			load: vi.fn().mockResolvedValue(rawCatalog()),
		};

		const result = await new ValidateReferentialCatalog(repository).execute();

		expect(repository.load).toHaveBeenCalledOnce();
		expect(result.isValid).toBe(true);
	});

	it("rejects duplicate display names", async () => {
		const result = await new ValidateReferentialCatalog().execute(
			rawCatalog({
				hosts: [
					hostRecord(),
					hostRecord({
						hostId: "host-0002",
						contactId: "contact-0002",
					}),
				],
				speakers: [
					speakerRecord(),
					speakerRecord({ speakerId: "speaker-0002" }),
				],
			}),
		);

		expect(result.isValid).toBe(false);
		expect(result.diagnostics.map(({ code }) => code)).toEqual([
			"referential.host.display-name.duplicate",
			"referential.speaker.display-name.duplicate",
		]);
		expect(result.diagnostics.every((item) => item.severity === "error")).toBe(
			true,
		);
		expect(result.diagnostics.every((item) => Object.isFrozen(item))).toBe(
			true,
		);
		expect(Object.isFrozen(result.diagnostics)).toBe(true);
	});

	it.each([
		[
			"host stable identifier",
			rawCatalog({ hosts: [hostRecord({ hostId: "invalid" })] }),
			"referential.host.id.invalid",
		],
		[
			"contact stable identifier",
			rawCatalog({ hosts: [hostRecord({ contactId: "invalid" })] }),
			"referential.contact.id.invalid",
		],
		[
			"speaker stable identifier",
			rawCatalog({ speakers: [speakerRecord({ speakerId: "invalid" })] }),
			"referential.speaker.id.invalid",
		],
		[
			"host contact email",
			rawCatalog({ hosts: [hostRecord({ email: "invalid" })] }),
			"referential.contact.email.invalid",
		],
		[
			"speaker email",
			rawCatalog({ speakers: [speakerRecord({ email: "invalid" })] }),
			"referential.speaker.email.invalid",
		],
	] as const)("rejects malformed %s", async (_description, input, code) => {
		const result = await new ValidateReferentialCatalog().execute(input);

		expect(result.isValid).toBe(false);
		expect(result.diagnostics.map((item) => item.code)).toContain(code);
	});

	it("rejects reused contact and speaker identifiers", async () => {
		const result = await new ValidateReferentialCatalog().execute(
			rawCatalog({
				hosts: [hostRecord(), hostRecord({ hostId: "host-0002" })],
				speakers: [speakerRecord(), speakerRecord()],
			}),
		);

		expect(result.isValid).toBe(false);
		expect(result.diagnostics.map(({ code }) => code)).toEqual(
			expect.arrayContaining([
				"referential.contact.id.duplicate",
				"referential.speaker.id.duplicate",
			]),
		);
	});

	it("never includes restricted contact values in diagnostics", async () => {
		const privateValues = [
			"Secret Person",
			"secret-address@example.invalid",
			"+33 6 66 66 66 66",
			"42 Confidential Avenue",
		];
		const result = await new ValidateReferentialCatalog().execute(
			rawCatalog({
				hosts: [
					hostRecord({
						contactName: privateValues[0],
						email: privateValues[1],
						phone: { raw: privateValues[2] },
						address: privateValues[3],
					}),
				],
			}),
		);

		const diagnosticMessages = result.diagnostics
			.map(({ message }) => message)
			.join("\n");
		for (const privateValue of privateValues) {
			expect(diagnosticMessages).not.toContain(privateValue);
		}
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.diagnostics)).toBe(true);
	});
});
