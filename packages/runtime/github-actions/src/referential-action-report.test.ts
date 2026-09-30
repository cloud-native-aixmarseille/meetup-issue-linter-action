import { describe, expect, it } from "vitest";
import { ActionMessages } from "./i18n/action-messages.js";
import { ReferentialActionReport } from "./referential-action-report.js";

describe("referential action report facts", () => {
	it.each([true, false])(
		"reports catalog validity and counts when valid is %s",
		(isValid) => {
			// Arrange
			const counts = {
				isValid,
				hostCount: isValid ? 3 : 0,
				speakerCount: isValid ? 7 : 0,
			};
			const diagnostics = [
				{
					code: "referential.example",
					severity: "warning" as const,
					message: "Review the catalog.",
				},
			];

			// Act
			const report = ReferentialActionReport.validation(counts, diagnostics);

			// Assert
			expect(report.details).toContain(
				isValid ? "Referentials: valid." : "Referentials: invalid.",
			);
			expect(report.details).toContain(
				isValid
					? "Valid hosts: 3; valid speakers: 7."
					: "Valid hosts: 0; valid speakers: 0.",
			);
			expect(
				report.details.join("\n").includes("zero-based record positions"),
			).toBe(!isValid);
			expect(report.diagnostics).toEqual(diagnostics);
			expect(report.failure).toBe(
				isValid
					? undefined
					: "Meetup referentials are invalid. Correct the catalog fields listed in the validation annotations and job summary.",
			);
		},
	);

	it.each([
		{ mode: "check", status: "Issue form is out of date.", guidance: true },
		{ mode: "fix", status: "Issue form was updated.", guidance: false },
	] as const)(
		"reports affected files in $mode mode",
		({ mode, status, guidance }) => {
			// Arrange
			const result = {
				changed: true,
				changedFiles: [".github/ISSUE_TEMPLATE/example.yml"],
				diagnostics: [],
			};

			// Act
			const report = ReferentialActionReport.issueForm(mode, result);

			// Assert
			expect(report.details).toContain(status);
			expect(report.details).toContain(
				"Affected files: .github/ISSUE_TEMPLATE/example.yml.",
			);
			expect(report.details.join("\n").includes("drift does not block")).toBe(
				guidance,
			);
			expect(report.failure).toBeUndefined();
		},
	);

	it.each([
		{
			locale: "en",
			guidance:
				"Issue-form drift does not block this check. Synchronization can run after merge.",
		},
		{
			locale: "fr",
			guidance:
				"Le décalage du formulaire ne bloque pas cette vérification. La synchronisation peut être exécutée après la fusion.",
		},
	])(
		"reports allowed drift with advisory guidance in $locale",
		({ locale, guidance }) => {
			// Arrange
			const result = {
				changed: true,
				changedFiles: [".github/ISSUE_TEMPLATE/example.yml"],
				diagnostics: [],
			};
			const messages = new ActionMessages(locale);

			// Act
			const report = ReferentialActionReport.issueForm(
				"check",
				result,
				messages,
			);

			// Assert
			expect(report.failure).toBeUndefined();
			expect(report.details).toContain(guidance);
			expect(report.details.join("\n")).toContain(
				".github/ISSUE_TEMPLATE/example.yml",
			);
			expect(report.details.join("\n")).not.toContain("mode: fix");
		},
	);

	it.each(["check", "fix"] as const)(
		"reports an unchanged issue form as current in %s mode",
		(mode) => {
			// Arrange
			const result = { changed: false, changedFiles: [], diagnostics: [] };

			// Act
			const report = ReferentialActionReport.issueForm(mode, result);

			// Assert
			expect(report.details).toEqual(["Issue form is up to date."]);
			expect(report.failure).toBeUndefined();
		},
	);

	it.each(["check", "fix"] as const)(
		"fails blocked synchronization in %s mode without claiming the issue form is current",
		(mode) => {
			// Arrange
			const result = {
				changed: false,
				changedFiles: [],
				diagnostics: [
					{
						code: "referential.speaker.id.invalid",
						severity: "error" as const,
						field: "speakers[0].speakerId",
						message: "Speaker stable identifiers must be valid.",
					},
				],
			};

			// Act
			const report = ReferentialActionReport.issueForm(mode, result);

			// Assert
			expect(report.details).toEqual([
				"Issue form synchronization is blocked by invalid referentials.",
			]);
			expect(report.diagnostics).toEqual(result.diagnostics);
			expect(report.failure).toBe(
				"Meetup referentials are invalid. Correct the catalog fields listed in the validation annotations and job summary.",
			);
		},
	);
});
