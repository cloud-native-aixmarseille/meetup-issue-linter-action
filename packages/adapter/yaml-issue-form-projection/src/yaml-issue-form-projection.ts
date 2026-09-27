import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type {
	IssueFormProjection,
	IssueFormProjectionMode,
} from "@meetup-automation/journey";
import { ProjectReferentialChoices } from "@meetup-automation/referential";
import * as yamlPlugin from "prettier/plugins/yaml";
import { format } from "prettier/standalone";
import { parseDocument } from "yaml";
import { IssueFormMessages } from "./i18n/issue-form-messages.js";
import {
	AVAILABLE_SPEAKERS_MARKER,
	HOST_FIELD_ID,
	type IssueFormProjectionDiagnostic,
	type IssueFormProjectionResult,
	type ResolvedIssueFormPath,
	type SynchronizeIssueFormInput,
	type UnknownRecord,
	type YamlIssueFormProjectionOptions,
} from "./yaml-issue-form-projection-contracts.js";

export class YamlIssueFormProjection implements IssueFormProjection {
	private readonly messages: IssueFormMessages;
	private readonly choices = new ProjectReferentialChoices();

	constructor(private readonly options: YamlIssueFormProjectionOptions) {
		this.messages = new IssueFormMessages(options.locale);
	}

	async synchronize(
		input: SynchronizeIssueFormInput,
	): Promise<IssueFormProjectionResult> {
		this.assertInput(input);
		const issueFormPath = await this.resolveIssueFormPath(input.issueFormPath);
		const source = await readFile(issueFormPath.absolutePath, "utf8");
		const document = parseDocument(source, {
			strict: true,
			uniqueKeys: true,
		});

		if (document.errors.length > 0) {
			throw new Error("Issue form is not valid YAML.");
		}

		const issueForm = document.toJS({ maxAliasCount: 100 }) as unknown;
		if (
			!YamlIssueFormProjection.isRecord(issueForm) ||
			!Array.isArray(issueForm.body)
		) {
			throw new Error("Issue form must contain a body array.");
		}

		const body = issueForm.body;
		const hostIndex = this.findSingleFieldIndex(
			body,
			HOST_FIELD_ID,
			"dropdown",
		);
		const speakersIndex = this.findSpeakersMarkdownIndex(body);
		const statusIndex = this.findOptionalFieldIndex(
			body,
			input.occurrenceStatusFieldId,
		);
		const projection = this.choices.execute(input.catalog);
		const speakersMarkdown = this.renderSpeakersMarkdown(
			projection.speakerReferences,
		);

		let changed = false;
		if (
			!YamlIssueFormProjection.sameStringArray(
				YamlIssueFormProjection.fieldOptions(body[hostIndex]),
				projection.hostOptions,
			)
		) {
			document.setIn(
				["body", hostIndex, "attributes", "options"],
				projection.hostOptions,
			);
			changed = true;
		}

		if (
			YamlIssueFormProjection.fieldValue(body[speakersIndex]) !==
			speakersMarkdown
		) {
			document.setIn(
				["body", speakersIndex, "attributes", "value"],
				speakersMarkdown,
			);
			changed = true;
		}

		if (statusIndex !== undefined) {
			document.deleteIn(["body", statusIndex]);
			changed = true;
		}

		if (changed && input.mode === "fix") {
			const content = await format(document.toString(), {
				parser: "yaml",
				plugins: [yamlPlugin],
			});
			await writeFile(issueFormPath.absolutePath, content, "utf8");
		}

		return this.result(changed, issueFormPath.relativePath, input.mode);
	}

	private assertInput(input: SynchronizeIssueFormInput): void {
		if (!input.issueFormPath.trim()) {
			throw new Error("Issue-form path must not be empty.");
		}
		if (input.mode !== "check" && input.mode !== "fix") {
			throw new Error("Issue-form projection mode must be check or fix.");
		}
	}

	private async resolveIssueFormPath(
		inputPath: string,
	): Promise<ResolvedIssueFormPath> {
		const root = await realpath(resolve(this.options.workspaceRoot));
		const candidate = resolve(root, inputPath);
		this.assertInsideWorkspace(root, candidate);

		const absolutePath = await realpath(candidate);
		this.assertInsideWorkspace(root, absolutePath);
		const metadata = await stat(absolutePath);
		if (!metadata.isFile()) {
			throw new Error("Configured issue-form path must reference a file.");
		}

		return {
			absolutePath,
			relativePath: relative(root, candidate).split(sep).join("/"),
		};
	}

	private assertInsideWorkspace(root: string, candidate: string): void {
		const childPath = relative(root, candidate);
		if (
			isAbsolute(childPath) ||
			childPath === ".." ||
			childPath.startsWith(`..${sep}`) ||
			childPath === ""
		) {
			throw new Error("Issue-form path must stay inside the checkout.");
		}
	}

	private findSingleFieldIndex(
		body: readonly unknown[],
		fieldId: string,
		expectedType: string,
	): number {
		const indexes = body.flatMap((item, index) =>
			YamlIssueFormProjection.isRecord(item) && item.id === fieldId
				? [index]
				: [],
		);
		if (indexes.length !== 1) {
			throw new Error(`Issue form must contain exactly one ${fieldId} field.`);
		}

		const index = indexes[0];
		const field = body[index];
		if (
			!YamlIssueFormProjection.isRecord(field) ||
			field.type !== expectedType
		) {
			throw new Error(`Issue-form field ${fieldId} must be a ${expectedType}.`);
		}
		if (!YamlIssueFormProjection.isRecord(field.attributes)) {
			throw new Error(`Issue-form field ${fieldId} must have attributes.`);
		}

		return index;
	}

	private findOptionalFieldIndex(
		body: readonly unknown[],
		fieldId: string,
	): number | undefined {
		const indexes = body.flatMap((item, index) =>
			YamlIssueFormProjection.isRecord(item) && item.id === fieldId
				? [index]
				: [],
		);
		if (indexes.length > 1) {
			throw new Error(`Issue form contains duplicate ${fieldId} fields.`);
		}
		return indexes[0];
	}

	private findSpeakersMarkdownIndex(body: readonly unknown[]): number {
		const indexes = body.flatMap((item, index) => {
			if (!YamlIssueFormProjection.isRecord(item) || item.type !== "markdown") {
				return [];
			}
			const value = YamlIssueFormProjection.fieldValue(item);
			return value?.includes(AVAILABLE_SPEAKERS_MARKER) ? [index] : [];
		});
		if (indexes.length !== 1) {
			throw new Error(
				"Issue form must contain exactly one Available speakers markdown block.",
			);
		}
		return indexes[0];
	}

	private renderSpeakersMarkdown(speakers: readonly string[]): string {
		const references = speakers
			.map(
				(speaker) =>
					`- <code>${YamlIssueFormProjection.escapeHtml(speaker)}</code>`,
			)
			.join("\n");

		return [
			AVAILABLE_SPEAKERS_MARKER,
			"",
			this.messages.t("form.speakers.guidance"),
			"",
			"<details>",
			`<summary>${this.messages.t("form.speakers.show")}</summary>`,
			"",
			references,
			"",
			"</details>",
		].join("\n");
	}

	private result(
		changed: boolean,
		relativePath: string,
		mode: IssueFormProjectionMode,
	): IssueFormProjectionResult {
		const changedFiles = Object.freeze(changed ? [relativePath] : []);
		const diagnostics: readonly IssueFormProjectionDiagnostic[] = changed
			? Object.freeze([
					Object.freeze(
						mode === "fix"
							? {
									code: "issue-form.updated" as const,
									severity: "info" as const,
									message: "Issue form was synchronized.",
								}
							: {
									code: "issue-form.out-of-date" as const,
									severity: "warning" as const,
									message: "Issue form requires synchronization.",
								},
					),
				])
			: Object.freeze([]);

		return Object.freeze({ changed, changedFiles, diagnostics });
	}

	private static isRecord(value: unknown): value is UnknownRecord {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}

	private static fieldOptions(field: unknown): unknown {
		if (
			!YamlIssueFormProjection.isRecord(field) ||
			!YamlIssueFormProjection.isRecord(field.attributes)
		) {
			return undefined;
		}
		return field.attributes.options;
	}

	private static fieldValue(field: unknown): string | undefined {
		if (
			!YamlIssueFormProjection.isRecord(field) ||
			!YamlIssueFormProjection.isRecord(field.attributes)
		) {
			return undefined;
		}
		return typeof field.attributes.value === "string"
			? field.attributes.value
			: undefined;
	}

	private static escapeHtml(value: string): string {
		return value
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;");
	}

	private static sameStringArray(
		actual: unknown,
		expected: readonly string[],
	): boolean {
		return (
			Array.isArray(actual) &&
			actual.length === expected.length &&
			actual.every((value, index) => value === expected[index])
		);
	}
}
