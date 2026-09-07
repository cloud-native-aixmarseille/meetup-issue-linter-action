import { describe, expect, it } from "vitest";
import {
	AUTOMATION_CONFIG_PATH,
	parseAutomationConfig,
	resultEnvelope,
} from "../src/index.js";

describe("opinionated automation configuration", () => {
	it("owns the configuration path and meetup conventions", () => {
		const result = parseAutomationConfig(undefined);

		expect(AUTOMATION_CONFIG_PATH).toBe(".github/meetup-automation.yml");
		expect(result).toMatchObject({
			timezone: "Europe/Paris",
			event: {
				"issue-label": "meetup",
				"issue-form": ".github/ISSUE_TEMPLATE/meetup.yml",
				"occurrence-status-field": "event_status",
				"required-confirmation-labels": [
					"hoster:confirmed",
					"speakers:confirmed",
				],
			},
			referentials: {
				hosts: "referentials/hosting.csv",
				speakers: "referentials/speakers.csv",
			},
			communication: {
				"approval-label": "communication:approved",
				"readiness-window-days": 7,
				"mailings-repository": "cloud-native-aixmarseille/mailings",
				"slack-enabled": true,
				"dispatch-enabled": true,
				"policy-version": 1,
			},
			publication: {
				"meetup-event-url-prefix":
					"https://www.meetup.com/cloud-native-aix-marseille/events/",
				"cncf-event-url-prefix":
					"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/",
			},
		});
	});

	it("ignores consumer-provided overrides and stays fully opinionated", () => {
		const result = parseAutomationConfig({
			timezone: "UTC",
			communication: {
				"dispatch-enabled": false,
				"policy-version": 99,
			},
		});

		expect(result.communication["dispatch-enabled"]).toBe(true);
		expect(result.communication["policy-version"]).toBe(1);
		expect(result.timezone).toBe("Europe/Paris");
	});
});

describe("result envelope", () => {
	it("uses a stable schema and diagnostic status", () => {
		expect(
			resultEnvelope({ changed: false }, [
				{
					code: "event.title.missing",
					severity: "error",
					message: "An event title is required",
				},
			]),
		).toMatchObject({ schemaVersion: 1, status: "diagnostics" });
	});
});
