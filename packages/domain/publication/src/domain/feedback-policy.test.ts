import { describe, expect, it } from "vitest";
import { FeedbackPolicy } from "./feedback-policy.js";

describe("feedback eligibility", () => {
	it.each(["2026-09-29T22:01:00Z", "2026-09-30T21:59:00Z"])(
		"uses the Paris calendar date at %s",
		(now) => {
			// Arrange
			const date = "2026-09-30";

			// Act
			const result = FeedbackPolicy.isEventDay(date, now, "Europe/Paris");

			// Assert
			expect(result).toBe(true);
		},
	);

	it.each(["2026-09-29T21:59:00Z", "2026-09-30T22:01:00Z"])(
		"does not activate before or after the event day at %s",
		(now) => {
			// Arrange
			const date = "2026-09-30";

			// Act
			const result = FeedbackPolicy.isEventDay(date, now, "Europe/Paris");

			// Assert
			expect(result).toBe(false);
		},
	);

	it.each([
		"https://evil.test/poll",
		"http://openfeedback.io/poll",
		"https://openfeedback.io.evil.test/poll",
		"https://user@openfeedback.io/poll",
		"https://openfeedback.io/poll?redirect=evil",
		"https://openfeedback.io/poll/session",
		"https://openfeedback.io/",
	])("rejects unsafe or non-event URLs: %s", (url) => {
		// Arrange
		// Use the supplied URL.

		// Act
		const parse = () => FeedbackPolicy.pollUrl(url);

		// Assert
		expect(parse).toThrow();
	});
});

it.each([
	"https://openfeedback.io/example/",
	"https://openfeedback.io/example/2026-09-30",
	"https://openfeedback.io/example/0",
])("accepts event links and the public date selector: %s", (url) => {
	// Arrange
	const expected = url.replace(/\/$/, "");

	// Act
	const result = FeedbackPolicy.pollUrl(url);

	// Assert
	expect(result).toBe(expected);
});

it.each([
	{ value: "2028-02-29", valid: true },
	{ value: "2027-02-29", valid: false },
	{ value: "invalid", valid: false },
])("validates calendar dates: $value", ({ value, valid }) => {
	// Arrange
	// Use the supplied calendar date.

	// Act
	const result = FeedbackPolicy.validDate(value);

	// Assert
	expect(result).toBe(valid);
});
