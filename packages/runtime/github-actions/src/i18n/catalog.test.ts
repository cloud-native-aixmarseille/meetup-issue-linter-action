import { describe, expect, it } from "vitest";
import { inspectCatalog } from "../../../../presentation/localization/testing/catalog-contract.js";
import { CATALOGS } from "./catalog.js";
import type { MessageParameters } from "./message-parameters.js";

const parameters = {
	"report.feedback.changes": {
		persisted: "true",
		linkUpdated: "false",
	},
	"report.fix-applied": {
		applied: "true",
	},
	"report.failed": {
		reason: "Safe reason.",
	},
	"report.referential.counts": {
		hosts: 2,
		speakers: 3,
	},
	"report.issue-form.files": {
		files: "form.yml",
	},
	"report.event.context": {
		issue: 42,
		mode: "check",
	},
	"report.event.state": {
		state: "ready",
		ready: "true",
	},
	"report.event.persisted": {
		persisted: "false",
		comment: "true",
	},
	"report.events.count": {
		count: 2,
	},
	"report.events.issues": {
		issues: "42, 43",
	},
	"report.assets.counts": {
		persisted: "false",
		count: 2,
	},
	"report.communication.mode": {
		mode: "check",
	},
	"report.communication.planned": {
		planned: 2,
		due: 1,
		dispatched: 0,
	},
	"report.communication.accepted": {
		accepted: 1,
		recorded: 0,
		deferred: 0,
	},
	"report.communication.uncertain": {
		uncertain: 0,
		rejected: 0,
	},
} satisfies { [Key in keyof MessageParameters]: MessageParameters[Key] };
describe("owned message catalogs", () => {
	it.each(["en", "fr"] as const)(
		"has complete, valid ICU messages and declared parameters for %s",
		(locale) => {
			// Arrange
			const catalog = CATALOGS[locale];
			// Act
			const inspected = inspectCatalog(CATALOGS, locale, parameters);
			// Assert
			expect(Object.keys(catalog).sort()).toEqual(
				Object.keys(CATALOGS.en).sort(),
			);
			for (const item of inspected) {
				expect(item.text, item.id).toBeTypeOf("string");
				expect(item.text, item.id).not.toBe("");
				expect(item.actual, item.id).toEqual(item.expected);
			}
		},
	);
});
