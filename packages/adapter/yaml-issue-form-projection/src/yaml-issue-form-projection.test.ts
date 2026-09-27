import { mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type RawReferentialCatalog,
	ValidateReferentialCatalog,
} from "@meetup-automation/referential";
import { check, format } from "prettier";
import { parse } from "yaml";
import { YamlIssueFormProjection } from "./yaml-issue-form-projection.js";

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
	it("keeps generated YAML formatted and preserves unrelated field values", async () => {
		// Arrange
		const unrelatedFields = String.raw`  - "type": "input"
    "id": "event_link"
    "attributes":
      "label": "Event Link"
      "placeholder":
        "https://events.example.test/details/cloud-native-example-community-\
        presents-example"
  - "type": "input"
    "id": "feedback_link"
    "attributes":
      "label": "Feedback Link"
      "description":
        "Provide an existing feedback event URL, or leave blank for automatic
        creation when configured."
`;
		const source = await format(INITIAL_FORM + unrelatedFields, {
			parser: "yaml",
		});
		const target = await fixture(source);
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});
		const input = {
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "fix" as const,
		};

		// Act
		const result = await adapter.synchronize(input);
		const updated = await readFile(target.absolutePath, "utf8");
		const formatted = await check(updated, { parser: "yaml" });
		const current = await adapter.synchronize({ ...input, mode: "check" });

		// Assert
		expect(result.changed).toBe(true);
		expect(formatted).toBe(true);
		expect(parse(updated).body.slice(-2)).toEqual(parse(source).body.slice(-2));
		expect(current.changed).toBe(false);
	});

	it("produces a stable French projection and detects drift when the requested locale changes", async () => {
		// Arrange
		const target = await fixture();
		const french = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
			locale: "fr",
		});
		const input = {
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "fix" as const,
		};
		await french.synchronize(input);
		const content = await readFile(target.absolutePath, "utf8");
		// Act
		const current = await french.synchronize({ ...input, mode: "check" });
		const english = await new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		}).synchronize({ ...input, mode: "check" });
		const after = await readFile(target.absolutePath, "utf8");
		// Assert
		expect(content).toContain(
			"Afficher les références des intervenants disponibles",
		);
		expect(content).toContain("<!-- Available speakers -->");
		expect(content).toContain("Unique &lt;Public&gt; Speaker &amp; Team");
		expect(content).not.toContain("speaker-one@example.test");
		expect(current.changed).toBe(false);
		expect(english.changed).toBe(true);
		expect(after).toBe(content);
	});

	it("updates referential projections, removes the occurrence dropdown, and preserves unrelated fields", async () => {
		// Arrange
		const target = await fixture();
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});

		// Act
		const result = await adapter.synchronize({
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "fix",
		});
		const updated = parse(await readFile(target.absolutePath, "utf8"));
		const fields = updated.body as Array<Record<string, unknown>>;
		const hoster = fields.find(({ id }) => id === "hoster") as {
			attributes: { options: string[] };
		};
		const speakers = fields.find(({ type, attributes }) => {
			return (
				type === "markdown" &&
				typeof (attributes as { value?: unknown })?.value === "string" &&
				(attributes as { value: string }).value.includes("Available speakers")
			);
		}) as { attributes: { value: string } };
		const status = fields.find(({ id }) => id === "event_status");
		const unrelated = fields.find(({ id }) => id === "unrelated");

		// Assert
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
		expect(hoster.attributes.options).toEqual([
			"Example Host",
			"Other Host",
			"Unique Host",
		]);
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
		expect(status).toBeUndefined();
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
		// Arrange
		const target = await fixture();
		const before = await readFile(target.absolutePath, "utf8");

		// Act
		const result = await new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		}).synchronize({
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "occurrence_state",
			catalog: await catalog(),
			mode: "check",
		});
		const after = await readFile(target.absolutePath, "utf8");
		const serializedResult = JSON.stringify(result);

		// Assert
		expect(result.changed).toBe(true);
		expect(result.diagnostics[0]).toMatchObject({
			code: "issue-form.out-of-date",
			severity: "warning",
		});
		expect(after).toBe(before);
		for (const privateValue of Object.values(PRIVATE_CONTACT_VALUES)) {
			expect(serializedResult).not.toContain(privateValue);
		}
	});

	it("is deterministic and performs no write once the projection is current", async () => {
		// Arrange
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

		// Act
		const result = await adapter.synchronize(input);
		const secondMetadata = await stat(target.absolutePath);
		const secondContent = await readFile(target.absolutePath, "utf8");

		// Assert
		expect(result).toEqual({
			changed: false,
			changedFiles: [],
			diagnostics: [],
		});
		expect(secondContent).toBe(firstContent);
		expect(secondMetadata.mtimeMs).toBe(firstMetadata.mtimeMs);
	});

	it.each(["before", "after"])(
		"removes a configured status field %s the projected fields without losing updates",
		async (position) => {
			// Arrange
			const statusField = `  - type: dropdown
    id: lifecycle
    attributes:
      label: Custom lifecycle label
      description: Keep this text
      options: [old]
    validations:
      required: false
`;
			const source =
				position === "before"
					? INITIAL_FORM.replace("body:\n", `body:\n${statusField}`)
					: INITIAL_FORM + statusField;
			const target = await fixture(source);
			const adapter = new YamlIssueFormProjection({
				workspaceRoot: target.workspaceRoot,
			});
			const input = {
				issueFormPath: target.issueFormPath,
				occurrenceStatusFieldId: "lifecycle",
				catalog: await catalog(),
				mode: "fix" as const,
			};

			// Act
			await adapter.synchronize(input);
			const form = parse(await readFile(target.absolutePath, "utf8"));
			const status = form.body.find(
				(field: { id?: string }) => field.id === "lifecycle",
			);
			const current = await adapter.synchronize({ ...input, mode: "check" });

			// Assert
			expect(status).toBeUndefined();
			expect(current.changed).toBe(false);
		},
	);

	it("rejects traversal outside the checkout", async () => {
		// Arrange
		const target = await fixture();
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});

		// Act
		const operation = adapter.synchronize({
			issueFormPath: "../outside.yml",
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "check",
		});

		// Assert
		await expect(operation).rejects.toThrow(
			"Issue-form path must stay inside the checkout.",
		);
	});

	it("rejects a symlink that resolves outside the checkout", async () => {
		// Arrange
		const target = await fixture();
		const outside = await fixture();
		const symlinkPath = join(target.workspaceRoot, "linked.yml");
		await symlink(outside.absolutePath, symlinkPath);

		// Act
		const operation = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		}).synchronize({
			issueFormPath: "linked.yml",
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "check",
		});

		// Assert
		await expect(operation).rejects.toThrow(
			"Issue-form path must stay inside the checkout.",
		);
	});

	it("rejects malformed form structure", async () => {
		// Arrange
		const target = await fixture("name: Meetup\nbody: invalid\n");
		const adapter = new YamlIssueFormProjection({
			workspaceRoot: target.workspaceRoot,
		});

		// Act
		const operation = adapter.synchronize({
			issueFormPath: target.issueFormPath,
			occurrenceStatusFieldId: "event_status",
			catalog: await catalog(),
			mode: "check",
		});

		// Assert
		await expect(operation).rejects.toThrow(
			"Issue form must contain a body array.",
		);
	});
});
