import { describe, expect, expectTypeOf, it } from "vitest";
import { ActionMessages } from "./action-messages.js";

describe("ActionMessages", () => {
	it.each([
		["", "en"],
		["en-GB", "en"],
		["fr", "fr"],
		[" fr-CA ", "fr"],
		["FR_fr", "fr"],
		["de-DE", "en"],
		["not a locale", "en"],
	])("resolves %s to %s", (requested, expected) => {
		// Arrange
		const messages = new ActionMessages(requested);
		// Act
		const locale = messages.locale;
		// Assert
		expect(locale).toBe(expected);
	});
	it.each([
		[0, "Aucun meetup actif."],
		[1, "1 meetup actif."],
		[2, "2 meetups actifs."],
	])("selects the French plural for %i", (count, expected) => {
		// Arrange
		const messages = new ActionMessages("fr");
		// Act
		const text = messages.t("report.events.count", { count: Number(count) });
		// Assert
		expect(text).toBe(expected);
	});
	it("formats numbers without leaking locale between instances", () => {
		// Arrange
		const french = new ActionMessages("fr");
		const english = new ActionMessages();
		// Act
		const before = french.t("report.referential.counts", {
			hosts: 1234,
			speakers: 2,
		});
		const other = english.t("report.events.count", { count: 1234 });
		const after = french.t("report.referential.counts", {
			hosts: 1234,
			speakers: 2,
		});
		// Assert
		expect(before).toContain("1\u202f234");
		expect(other).toBe("Active events: 1,234.");
		expect(after).toBe(before);
	});
	it("inserts values literally without treating them as ICU or HTML", () => {
		// Arrange
		const messages = new ActionMessages("fr");
		const reason = "<script>{other, plural, one {x}}</script>";
		// Act
		const text = messages.t("report.failed", { reason });
		// Assert
		expect(text).toBe(`Échec de l'action : ${reason}`);
	});
	it("translates known diagnostics and preserves already-redacted unknown diagnostics", () => {
		// Arrange
		const french = new ActionMessages("fr");
		const english = new ActionMessages();
		// Act
		const translated = french.diagnostic(
			"referential.speaker.id.duplicate",
			"English detail.",
		);
		const fallback = french.diagnostic("future.check", "Safe fallback.");
		const canonical = english.diagnostic(
			"event.date.invalid",
			"Specific safe detail.",
		);
		// Assert
		expect(translated).toBe(
			"Les identifiants stables des intervenants doivent être uniques.",
		);
		expect(fallback).toBe("Safe fallback.");
		expect(canonical).toBe("Specific safe detail.");
	});
	it("requires the correct interpolation parameters at compile time", () => {
		// Arrange
		const messages = new ActionMessages();
		// Act
		const count = messages.t<"report.events.count">;
		const plain = messages.t<"report.no-diagnostics">;
		// Assert
		expectTypeOf(count).parameters.toEqualTypeOf<
			[key: "report.events.count", parameters: { count: number }]
		>();
		expectTypeOf(plain).parameters.toEqualTypeOf<
			[key: "report.no-diagnostics"]
		>();
	});
	it("localizes classified failures and falls back safely for unknown exceptions", () => {
		// Arrange
		const french = new ActionMessages("fr");
		const english = new ActionMessages();
		// Act
		const known = french.error("EventNotFoundError", "Safe English detail.");
		const unknown = french.error("UnknownError", "Safe English fallback.");
		const canonical = english.error(
			"EventNotFoundError",
			"Safe English detail.",
		);
		// Assert
		expect(known).toContain("L'événement est introuvable.");
		expect(unknown).toContain("L'automatisation du meetup a échoué");
		expect(canonical).toBe("Safe English detail.");
	});
	it.each([
		"event.link.feedback.invalid",
		"publication.feedback.unrelated",
		"publication.feedback.inactive",
		"publication.feedback.prerequisites",
		"publication.feedback.creation-pending",
		"publication.feedback.ambiguous-date",
	])("translates the dynamically emitted feedback diagnostic %s", (code) => {
		// Arrange
		const french = new ActionMessages("fr");

		// Act
		const translated = french.diagnostic(code, "MISSING");

		// Assert
		expect(translated).not.toBe("MISSING");
	});
});
