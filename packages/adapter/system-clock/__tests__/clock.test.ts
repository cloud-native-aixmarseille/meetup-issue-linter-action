import { describe, expect, it } from "vitest";
import { SystemCommunicationClock, SystemEventClock } from "../src/index.js";

describe("system clocks", () => {
	it("adapts a Date factory to both domain clock contracts", () => {
		const instant = new Date("2026-03-29T00:30:00.000Z");
		expect(new SystemEventClock(() => instant).now()).toBe(
			instant.toISOString(),
		);
		expect(new SystemCommunicationClock(() => instant).now()).toBe(instant);
	});
});
