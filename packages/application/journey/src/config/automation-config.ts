import { z } from "zod";

export const AUTOMATION_CONFIG_PATH = ".github/meetup-automation.yml";

const resolvedAutomationConfigSchema = z.object({
	"schema-version": z.literal(1),
	timezone: z.string(),
	event: z.object({
		"issue-label": z.string(),
		"issue-form": z.string(),
		"occurrence-status-field": z.string(),
		"required-confirmation-labels": z.array(z.string()),
	}),
	referentials: z.object({
		hosts: z.string(),
		speakers: z.string(),
	}),
	communication: z.object({
		"readiness-window-days": z.number(),
		"mailings-repository": z.string(),
		"slack-enabled": z.boolean(),
		"approval-label": z.string(),
		"dispatch-enabled": z.boolean(),
		"policy-version": z.number(),
	}),
	publication: z.object({
		"meetup-event-url-prefix": z.string(),
		"cncf-event-url-prefix": z.string(),
	}),
});

export type AutomationConfig = z.infer<typeof resolvedAutomationConfigSchema>;

/**
 * Automation behavior is owned and versioned by this repository. Consumer
 * repositories do not provide a runtime configuration file anymore.
 */

function createOpinionatedAutomationConfig(): AutomationConfig {
	return {
		"schema-version": 1,
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
			"readiness-window-days": 7,
			"mailings-repository": "cloud-native-aixmarseille/mailings",
			"slack-enabled": true,
			"approval-label": "communication:approved",
			"dispatch-enabled": true,
			"policy-version": 1,
		},
		publication: {
			"meetup-event-url-prefix":
				"https://www.meetup.com/cloud-native-aix-marseille/events/",
			"cncf-event-url-prefix":
				"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/",
		},
	};
}

export const automationConfigSchema = z
	.unknown()
	.transform(() => createOpinionatedAutomationConfig());

export function parseAutomationConfig(value: unknown): AutomationConfig {
	return automationConfigSchema.parse(value);
}

export interface AutomationConfigRepository {
	load(configPath: string): Promise<AutomationConfig>;
}
