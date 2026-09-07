import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	setDiagnosticsOutput,
	setJsonOutput,
} from "../packages/runtime/github-actions/src/action-output.js";
import {
	booleanInput,
	positiveIntegerInput,
	publicErrorMessage,
} from "../packages/runtime/github-actions/src/runtime-input.js";

vi.mock("@actions/core", () => ({ setOutput: vi.fn() }));

describe("GitHub Action output boundary", () => {
	beforeEach(() => vi.clearAllMocks());

	it("serializes structured outputs exactly once", () => {
		setJsonOutput("result", { status: "ok", count: 2 });
		setDiagnosticsOutput([
			{ code: "safe.code", severity: "warning", message: "Safe message" },
		]);

		expect(core.setOutput).toHaveBeenNthCalledWith(
			1,
			"result",
			'{"status":"ok","count":2}',
		);
		expect(core.setOutput).toHaveBeenNthCalledWith(
			2,
			"diagnostics",
			'[{"code":"safe.code","severity":"warning","message":"Safe message"}]',
		);
	});
});

describe("GitHub Action input and error boundary", () => {
	it("accepts an explicit true and rejects unsafe numeric overflow", () => {
		expect(booleanInput("dispatch-authorized", "true")).toBe(true);
		expect(() =>
			positiveIntegerInput("issue-number", "9007199254740992"),
		).toThrow("issue-number must be a positive integer");
	});

	it("passes through only allow-listed error classes", () => {
		const known = new Error("configuration is invalid");
		known.name = "ZodError";

		expect(publicErrorMessage(known)).toBe(
			"ZodError: configuration is invalid",
		);
		expect(publicErrorMessage({ message: "contact@example.test" })).toBe(
			"Meetup automation failed; inspect debug logs using a trusted runner",
		);
	});
});
