import { describe, expect, it } from "vitest";
import { YamlAutomationConfigRepository } from "../src/index.js";

describe("YamlAutomationConfigRepository", () => {
	it("returns the opinionated automation configuration without reading a file", async () => {
		const result = await new YamlAutomationConfigRepository().load();

		expect(result.timezone).toBe("Europe/Paris");
		expect(result.communication["dispatch-enabled"]).toBe(true);
		expect(result.communication["policy-version"]).toBe(1);
	});
});
