import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CommunicationDiagnostic } from "@meetup-automation/communication";
import type { CommunicationJourneyDiagnostic } from "@meetup-automation/journey";
import type { ReferentialDiagnostic } from "@meetup-automation/referential";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { EventCommentMessages } from "../../packages/adapter/github-event-comment-repository/src/i18n/event-comment-messages.js";
import type { IssueFormMessages } from "../../packages/adapter/yaml-issue-form-projection/src/i18n/issue-form-messages.js";
import { ActionMessages } from "../../packages/runtime/github-actions/src/i18n/action-messages.js";
import type { MessageId } from "../../packages/runtime/github-actions/src/i18n/catalog.js";
import type { OrganizerNotificationMessages } from "../../packages/runtime/github-actions/src/notifications/organizer-notification-messages.js";
import {
	type ActionManifest,
	automationActionPrefix,
	readYaml,
	root,
	type Workflow,
	workflowExpression,
} from "./support.js";

describe("localization contract", () => {
	it("gives every published action the same English-default locale input", async () => {
		// Arrange
		const paths = (
			await readdir(join(root, "actions"), { recursive: true })
		).filter((path) => path.endsWith("/action.yml"));
		// Act
		const actions = await Promise.all(
			paths.map((path) => readYaml<ActionManifest>(join("actions", path))),
		);
		// Assert
		expect(actions.length).toBeGreaterThan(0);
		for (const action of actions)
			expect(action.inputs?.locale).toMatchObject({
				required: false,
				default: "en",
			});
	});
	it("forwards locale through every reusable workflow action and keeps reporting in actions", async () => {
		// Arrange
		const paths = (await readdir(join(root, ".github/workflows"))).filter(
			(path) => path.endsWith(".yml"),
		);
		// Act
		const workflows = await Promise.all(
			paths.map((path) => readYaml<Workflow>(join(".github/workflows", path))),
		);
		const publicWorkflows = workflows.filter((workflow) =>
			Object.values(workflow.jobs ?? {}).some((job) =>
				job.steps?.some((step) =>
					step.uses?.startsWith(automationActionPrefix),
				),
			),
		);
		// Assert
		expect(publicWorkflows.length).toBeGreaterThan(0);
		for (const workflow of publicWorkflows) {
			expect(workflow.on?.workflow_call?.inputs?.locale).toMatchObject({
				default: "en",
				required: false,
				type: "string",
			});
			for (const job of Object.values(workflow.jobs ?? {}))
				for (const step of job.steps ?? []) {
					if (step.uses?.startsWith(automationActionPrefix))
						expect(step.with?.locale).toBe(workflowExpression("inputs.locale"));
					expect(step.run ?? "").not.toContain("GITHUB_STEP_SUMMARY");
				}
		}
	});
	it("provides a French translation for statically declared public diagnostic codes", async () => {
		// Arrange
		const paths = (
			await readdir(join(root, "packages"), { recursive: true })
		).filter(
			(path) =>
				path.includes("/src/") &&
				path.endsWith(".ts") &&
				!path.endsWith(".test.ts") &&
				!path.includes("node_modules") &&
				!path.startsWith("presentation/"),
		);
		const messages = new ActionMessages("fr");
		// Act
		const codes = new Set<string>();
		for (const path of paths) {
			const source = await readFile(join(root, "packages", path), "utf8");
			for (const match of source.matchAll(
				/"(?:((?:event|referential|publication|issue-form|communication)\.[a-z-]+(?:\.[a-z-]+)*))"/g,
			))
				if (match[1] !== "communication.organizer-attention")
					codes.add(match[1]);
		}
		const missing = [...codes].filter(
			(code) => messages.diagnostic(code, "MISSING") === "MISSING",
		);
		// Assert
		expect(codes.size).toBeGreaterThan(80);
		expect(missing).toEqual([]);
		expectTypeOf<`diagnostic.communication.${CommunicationDiagnostic["code"]}`>().toExtend<MessageId>();
		expectTypeOf<`diagnostic.${CommunicationJourneyDiagnostic["code"]}`>().toExtend<MessageId>();
		expectTypeOf<`diagnostic.${ReferentialDiagnostic["code"]}`>().toExtend<MessageId>();
	});
	it("keeps feature catalogs and application dependencies out of shared formatting infrastructure", async () => {
		// Arrange
		const directory = join(root, "packages/presentation/localization/src");
		const files = (await readdir(directory, { recursive: true })).filter(
			(path) => path.endsWith(".ts") && !path.endsWith(".test.ts"),
		);
		// Act
		const sources = await Promise.all(
			files.map(async (path) => ({
				path,
				source: await readFile(join(directory, path), "utf8"),
			})),
		);
		const catalogs = files.filter((path) => /\.(?:en|fr)\.ts$/.test(path));
		const coupled = sources.filter(({ source }) =>
			/["'](?:action|report|diagnostic|error|comment|form|communication)\.[\w.-]+["']\s*:|@meetup-automation\//.test(
				source,
			),
		);
		// Assert
		expect(files.length).toBeGreaterThan(0);
		expect(catalogs).toEqual([]);
		expect(coupled.map(({ path }) => path)).toEqual([]);
	});

	it("restricts each presenter to its own message keys", () => {
		// Arrange
		type ReportKeys = Parameters<ActionMessages["t"]>[0];
		type CommentKeys = Parameters<EventCommentMessages["t"]>[0];
		type FormKeys = Parameters<IssueFormMessages["t"]>[0];
		type NotificationKeys = Parameters<OrganizerNotificationMessages["t"]>[0];
		// Act
		type ForeignReportKeys = Exclude<
			ReportKeys,
			| `action.${string}`
			| `report.${string}`
			| `diagnostic.${string}`
			| `error.${string}`
			| `workflow.${string}`
		>;
		type ForeignCommentKeys = Exclude<CommentKeys, `comment.${string}`>;
		type ForeignFormKeys = Exclude<FormKeys, `form.${string}`>;
		type ForeignNotificationKeys = Exclude<
			NotificationKeys,
			`communication.${string}`
		>;
		// Assert
		expectTypeOf<ForeignReportKeys>().toEqualTypeOf<never>();
		expectTypeOf<ForeignCommentKeys>().toEqualTypeOf<never>();
		expectTypeOf<ForeignFormKeys>().toEqualTypeOf<never>();
		expectTypeOf<ForeignNotificationKeys>().toEqualTypeOf<never>();
	});
});
