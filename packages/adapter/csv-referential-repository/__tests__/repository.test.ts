import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CsvReferentialRepository } from "../src/index.js";

describe("CsvReferentialRepository", () => {
	it("maps the checked-out CSV files without logging contact data", async () => {
		const root = await mkdtemp(join(tmpdir(), "meetup-csv-"));
		await mkdir(join(root, "referentials"));
		await writeFile(
			join(root, "referentials/hosts.csv"),
			"host_id,name,contact_id,contact,mail,phone,address\n" +
				"host-0001,Example,contact-0001,Pat,pat@example.invalid,,Somewhere\n",
		);
		await writeFile(
			join(root, "referentials/speakers.csv"),
			"speaker_id,firstname,lastname,company,mail,phone\n" +
				"speaker-0001,Sam,Example,Example,sam@example.invalid,\n",
		);

		const result = await new CsvReferentialRepository({
			workspaceRoot: root,
			hostsPath: "referentials/hosts.csv",
			speakersPath: "referentials/speakers.csv",
		}).load();

		expect(result.hosts).toHaveLength(1);
		expect(result.speakers[0]?.speakerId).toBe("speaker-0001");
		expect(result.hosts[0]?.contactId).toBe("contact-0001");
	});

	it("rejects paths outside the checkout", async () => {
		const root = await mkdtemp(join(tmpdir(), "meetup-csv-"));
		await expect(
			new CsvReferentialRepository({
				workspaceRoot: root,
				hostsPath: "../hosts.csv",
				speakersPath: "speakers.csv",
			}).load(),
		).rejects.toThrow(/inside the checkout/);
	});
});
