import { describe, expect, it } from "vitest";
import {
	booleanInput,
	enumInput,
	positiveIntegerInput,
	publicErrorMessage,
} from "./runtime-input.js";

describe("GitHub Action input parsing", () => {
	it("accepts only positive safe issue numbers", () => {
		expect(positiveIntegerInput("issue-number", "42")).toBe(42);
		expect(() => positiveIntegerInput("issue-number", "0")).toThrow(
			"issue-number must be a positive integer",
		);
		expect(() => positiveIntegerInput("issue-number", "1.2")).toThrow();
	});

	it("checks enum and boolean values without coercion", () => {
		expect(enumInput("mode", "check", ["check", "fix"])).toBe("check");
		expect(() => enumInput("mode", "write", ["check", "fix"])).toThrow();
		expect(booleanInput("authorized", "false")).toBe(false);
		expect(() => booleanInput("authorized", "1")).toThrow();
	});

	it("redacts unexpected exception messages", () => {
		expect(publicErrorMessage(new Error("email@example.test"))).not.toContain(
			"email@example.test",
		);
	});
});
