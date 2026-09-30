import { describe, expect, it } from "vitest";
import { RuntimeInput } from "./runtime-input.js";

describe("GitHub Action input parsing", () => {
	it("accepts a positive safe issue identifier", () => {
		// Arrange
		const input = "42";

		// Act
		const result = RuntimeInput.positiveIntegerInput("issue-number", input);

		// Assert
		expect(result).toBe(42);
	});

	it.each(["0", "1.2", "9007199254740992"])(
		"rejects invalid issue identifier %s",
		(input) => {
			// Arrange
			const name = "issue-number";

			// Act
			const parse = () => RuntimeInput.positiveIntegerInput(name, input);

			// Assert
			expect(parse).toThrow("issue-number must be a positive integer");
		},
	);

	it.each(["check", "fix"])("accepts the allowed enum value %s", (input) => {
		// Arrange
		const allowed = ["check", "fix"];

		// Act
		const result = RuntimeInput.enumInput("mode", input, allowed);

		// Assert
		expect(result).toBe(input);
	});

	it("rejects an enum value outside the allowed set", () => {
		// Arrange
		const input = "write";
		const allowed = ["check", "fix"];

		// Act
		const parse = () => RuntimeInput.enumInput("mode", input, allowed);

		// Assert
		expect(parse).toThrow("mode must be one of: check, fix");
	});

	it.each([
		["true", true],
		["false", false],
	] as const)("accepts the explicit boolean value %s", (input, expected) => {
		// Arrange
		const name = "authorized";

		// Act
		const result = RuntimeInput.booleanInput(name, input);

		// Assert
		expect(result).toBe(expected);
	});

	it("rejects implicit boolean coercion", () => {
		// Arrange
		const input = "1";

		// Act
		const parse = () => RuntimeInput.booleanInput("authorized", input);

		// Assert
		expect(parse).toThrow("authorized must be true or false");
	});

	it("redacts unexpected exception messages", () => {
		// Arrange
		const error = new Error("email@example.test");

		// Act
		const message = RuntimeInput.publicErrorMessage(error);

		// Assert
		expect(message).not.toContain(error.message);
	});
});

describe("GitHub Action input and error boundary", () => {
	it("accepts an explicit true and rejects unsafe numeric overflow", () => {
		// Arrange
		// No additional setup is needed.

		// Act
		const actual = RuntimeInput.booleanInput("report-errors-to-issue", "true");
		const act = () =>
			RuntimeInput.positiveIntegerInput("issue-number", "9007199254740992");

		// Assert
		expect(actual).toBe(true);
		expect(act).toThrow("issue-number must be a positive integer");
	});

	it("passes through only allow-listed error classes", () => {
		// Arrange
		const known = new Error("configuration is invalid");
		known.name = "EventNotFoundError";

		// Act
		const actual = RuntimeInput.publicErrorMessage(known);
		const actual1 = RuntimeInput.publicErrorMessage({
			message: "contact@example.test",
		});

		// Assert
		expect(actual).toBe("EventNotFoundError: configuration is invalid");
		expect(actual1).toBe(
			"Meetup automation failed; inspect debug logs using a trusted runner",
		);
	});
});
