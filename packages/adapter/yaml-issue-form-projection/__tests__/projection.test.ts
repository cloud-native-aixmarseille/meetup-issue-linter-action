import { mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type RawReferentialCatalog,
	ValidateReferentialCatalog,
} from "@meetup-automation/referential";
import { parse } from "yaml";
import { YamlIssueFormProjection } from "../src/index.js";

const PRIVATE_CONTACT_VALUES = {
	contactName: "Private Host Contact",
	email: "private-host@example.test",
	phone: "+33 6 11 22 33 44",
	address: "42 Confidential Avenue",
};

async function catalog() {
	const raw: RawReferentialCatalog = {
		hosts: [
			{
				hostId: "host-0001",
				displayName: "Example Host",
				contactId: "contact-0001",
				...PRIVATE_CONTACT_VALUES,
			},
			{
				hostId: "host-0002",
				displayName: "Other Host",
				contactId: "contact-0002",
				contactName: "Another Private Contact",
				email: "another@example.test",
				phone: "",
				address: "Another Confidential Avenue",
			},
			{
				hostId: "host-0003",
				displayName: "Unique Host",
				contactId: "contact-0003",
				contactName: "Unique Contact",
				email: "unique@example.test",
				phone: "",
				address: "Unique Address",
			},
		],
		speakers: [
			{
				speakerId: "speaker-0001",
				firstName: "Example",
				lastName: "Speaker",
				company: "Private Company",
				email: "speaker-one@example.test",
				phone: "+33 6 55 55 55 55",
			},
			{
				speakerId: "speaker-0002",
				firstName: "Other",
				lastName: "Speaker",
				company: "Another Company",
				email: "speaker-two@example.test",
				phone: "",
			},
			{
				speakerId: "speaker-0003",
				firstName: "Unique <Public>",
				lastName: "Speaker & Team",
				company: "Unique Company",
				email: "speaker-unique@example.test",
				phone: "",
			},
		],
	};
	const validation = await new ValidateReferentialCatalog().execute(raw);
	if (!validation.isValid) {
		throw new Error("Test catalog must be valid");
	}
	return validation.catalog;
}

const INITIAL_FORM = `name: Meetup
description: Gather event data
title: "[Meetup]"
labels:
  - meetup
body:
  - type: input
    id: event_title
    attributes:
      label: Event Title
      custom-property: preserved
  - type: dropdown
    id: hoster
    attributes:
      label: Hoster
      options:
        - Old Host
  - type: markdown
    attributes:
      value: |-
        <!-- Available speakers -->
        <!--
        Old Speaker
        -->
  - type: textarea
    id: unrelated
    attributes:
      label: Unrelated field
      description: Must survive synchronization
`;

async function fixture(source = INITIAL_FORM) {
	const workspaceRoot = await mkdtemp(join(tmpdir(), "issue-form-projection-"));
	const issueFormPath = "meetup.yml";
	const absolutePath = join(workspaceRoot, issueFormPath);
	await writeFile(absolutePath, source, "utf8");
	return { workspaceRoot, issueFormPath, absolutePath };
}

describe("YamlIssueFormProjection", () => {
	it("updates referential projections, removes the occurrence dropdown, and preserves unrelated fields", async () => {
		const target = await fixture();
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});

		const result = await adapter.synchronize({
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "fix",
		});

		expect(result).toEqual({
			changed: true,
			changedFiles: ["meetup.yml"],
			diagnostics: [
				{
					code: "issue-form.updated",
					severity: "info",
					message: "Issue form was synchronized.",
				},
			],
		});
		const updated = parse(await readFile(target.absolutePath, "utf8"));
		const fields = updated.body as Array<Record<string, unknown>>;
		const hoster = fields.find(({ id }) => id === "hoster") as {
			attributes: { options: string[] };
		};
		expect(hoster.attributes.options).toEqual([
			"Example Host",
			"Other Host",
			"Unique Host",
		]);

		const speakers = fields.find(({ type, attributes }) => {
			return (
				type === "markdown" &&
				typeof (attributes as { value?: unknown })?.value === "string" &&
				(attributes as { value: string }).value.includes("Available speakers")
			);
		}) as { attributes: { value: string } };
		expect(speakers.attributes.value).toBe(
			[
				"<!-- Available speakers -->",
				"",
				"Select speakers by copying one or more references into the agenda.",
				"",
				"<details>",
				"<summary>Show available speaker references</summary>",
				"",
				"- <code>Example Speaker</code>",
				"- <code>Other Speaker</code>",
				"- <code>Unique &lt;Public&gt; Speaker &amp; Team</code>",
				"",
				"</details>",
			].join("\n"),
		);
		expect(speakers.attributes.value).not.toContain("Private Company");
		expect(speakers.attributes.value).not.toContain("speaker-one@example.test");

		const status = fields.find(({ id }) => id === "event_status");
		expect(status).toBeUndefined();

		const unrelated = fields.find(({ id }) => id === "unrelated");
		expect(unrelated).toEqual({
			type: "textarea",
			id: "unrelated",
			attributes: {
				label: "Unrelated field",
				description: "Must survive synchronization",
			},
		});
		expect(fields[0]).toMatchObject({
			id: "event_title",
			attributes: { "custom-property": "preserved" },
		});
	});

	it("reports changes without writing in check mode and exposes no contact data", async () => {
		const target = await fixture();
		const before = await readFile(target.absolutePath, "utf8");
		const result = await new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		}).synchronize({
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "occurrence_state",
			catalog: await catalog(),
			mode: "check",
		});

		expect(result.changed).toBe(true);
		expect(result.diagnostics[0]).toMatchObject({
			code: "issue-form.out-of-date",
			severity: "warning",
		});
		expect(await readFile(target.absolutePath, "utf8")).toBe(before);
		const serializedResult = JSON.stringify(result);
		for (const privateValue of Object.values(PRIVATE_CONTACT_VALUES)) {
			expect(serializedResult).not.toContain(privateValue);
		}
	});

	it("is deterministic and performs no write once the projection is current", async () => {
		const target = await fixture();
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});
		const input = {
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "fix" as const,
		};
		await adapter.synchronize(input);
		const firstContent = await readFile(target.absolutePath, "utf8");
		const firstMetadata = await stat(target.absolutePath);

		const result = await adapter.synchronize(input);
		const secondMetadata = await stat(target.absolutePath);

		expect(result).toEqual({
			changed: false,
			changedFiles: [],
			diagnostics: [],
		});
		expect(await readFile(target.absolutePath, "utf8")).toBe(firstContent);
		expect(secondMetadata.mtimeMs).toBe(firstMetadata.mtimeMs);
	});

	it("removes an existing configured status field", async () => {
		const target = await fixture(`${INITIAL_FORM}  - type: dropdown
    id: lifecycle
    attributes:
      label: Custom lifecycle label
      description: Keep this text
      options: [old]
    validations:
      required: false
`);
		await new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		}).synchronize({
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "lifecycle",
			catalog: await catalog(),
			mode: "fix",
		});

		const form = parse(await readFile(target.absolutePath, "utf8"));
		const status = form.body.find(
			(field: { id?: string }) => field.id === "lifecycle",
		);
		expect(status).toBeUndefined();
	});

	it("rejects traversal outside the checkout", async () => {
		const target = await fixture();
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});

		await expect(
			adapter.synchronize({
				issueFormPath: "../outside.yml",
				occurrenceStatusFieldId: "event_status",
				catalog: await catalog(),
				mode: "check",
			}),
		).rejects.toThrow("Issue-form path must stay inside the checkout.");
	});

	it("rejects a symlink that resolves outside the checkout", async () => {
		const target = await fixture();
		const outside = await fixture();
		const symlinkPath = join(target.workspaceRoot, "linked.yml");
		await symlink(outside.absolutePath, symlinkPath);

		await expect(
			new YamlIssueFormProjection({
				workspaceRoot: target.workspaceRoot,
			}).synchronize({
				issueFormPath: "linked.yml",
				occurrenceStatusFieldId: "event_status",
				catalog: await catalog(),
				mode: "check",
			}),
		).rejects.toThrow("Issue-form path must stay inside the checkout.");
	});

	it("rejects malformed form structure", async () => {
		const target = await fixture("name: Meetup\nbody: invalid\n");
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});

		await expect(
			adapter.synchronize({
				issueFormPath: target.issueFormPath,
				occurrenceStatusFieldId: "event_status",
				catalog: await catalog(),
				mode: "check",
			}),
		).rejects.toThrow("Issue form must contain a body array.");
	});
});
